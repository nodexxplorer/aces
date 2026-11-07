// Package invitation implements tenant-bound, approved, single-use access invitations.
package invitation

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/aces/backend/internal/email"
	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrInvalid   = errors.New("invalid, expired or unavailable invitation")
	ErrForbidden = errors.New("you do not have permission for this invitation")
	ErrConflict  = errors.New("an open invitation already exists, or HOD bootstrap is already complete")
	ErrRateLimit = errors.New("invitation limit reached; try again later")
	ErrSignIn    = errors.New("sign in to the invited account before accepting")
)

const Lifetime = 72 * time.Hour

var GrantKeys = []string{"can_manage_results", "can_manage_users", "can_manage_finance", "can_manage_courses", "can_view_analytics", "can_manage_announcements", "can_backup_data", "can_manage_complaints", "can_manage_alumni", "can_manage_course_forms", "can_manage_settings"}

type Pool interface {
	Begin(context.Context) (pgx.Tx, error)
}
type Service struct {
	Pool        Pool
	Sender      email.EmailSender
	FrontendURL string
}
type Request struct {
	Email  string          `json:"email"`
	Name   string          `json:"name"`
	Role   string          `json:"role"`
	Grants map[string]bool `json:"grants"`
}
type Invitation struct {
	ID             uuid.UUID       `json:"id"`
	Email          string          `json:"email"`
	Name           string          `json:"name"`
	Role           string          `json:"role"`
	Grants         map[string]bool `json:"grants"`
	Status         string          `json:"status"`
	Bootstrap      bool            `json:"bootstrap"`
	RequestedBy    *uuid.UUID      `json:"requestedBy"`
	ApprovedBy     *uuid.UUID      `json:"approvedBy"`
	AcceptedBy     *uuid.UUID      `json:"acceptedBy"`
	ExpiresAt      time.Time       `json:"expiresAt"`
	CreatedAt      time.Time       `json:"createdAt"`
	ApprovedAt     *time.Time      `json:"approvedAt"`
	AcceptedAt     *time.Time      `json:"acceptedAt"`
	LastSentAt     *time.Time      `json:"lastSentAt"`
	DeliveryFailed bool            `json:"deliveryFailed"`
}
type Authority struct {
	HOD         bool
	ManageUsers bool
}

func (a Authority) CanInvite() bool { return a.HOD || a.ManageUsers }
func (a Authority) CanAuthorize(role string) bool {
	return a.HOD || (role == "lecturer" && a.ManageUsers)
}
func Normalize(r Request) (Request, error) {
	if strings.ContainsAny(r.Email+r.Name, "\r\n") {
		return r, ErrInvalid
	}
	r.Email = strings.ToLower(strings.TrimSpace(r.Email))
	r.Name = strings.TrimSpace(r.Name)
	addr, err := mail.ParseAddress(r.Email)
	if err != nil || addr.Address != r.Email || len(r.Email) > 255 || len(r.Name) == 0 || len(r.Name) > 200 || strings.ContainsAny(r.Name, "\r\n") {
		return r, ErrInvalid
	}
	if r.Role == "admin" {
		r.Role = "delegated_admin"
	}
	if r.Role != "hod" && r.Role != "lecturer" && r.Role != "delegated_admin" {
		return r, ErrInvalid
	}
	valid := map[string]bool{}
	for _, k := range GrantKeys {
		valid[k] = true
	}
	for k := range r.Grants {
		if !valid[k] || r.Role != "delegated_admin" {
			return r, ErrInvalid
		}
	}
	if r.Grants == nil {
		r.Grants = map[string]bool{}
	}
	return r, nil
}
func NewToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
func HashToken(token string) (string, error) {
	if len(token) != 64 {
		return "", ErrInvalid
	}
	b, err := hex.DecodeString(token)
	if err != nil || len(b) != 32 {
		return "", ErrInvalid
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:]), nil
}
func FrontendOrigin(raw string) (string, error) {
	u, err := url.Parse(strings.TrimRight(raw, "/"))
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") || (u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1"))) {
		return "", errors.New("FRONTEND_PUBLIC_URL must be an HTTPS origin (HTTP localhost is allowed for development)")
	}
	return strings.TrimRight(u.String(), "/"), nil
}
func (s *Service) begin(ctx context.Context) (pgx.Tx, tenant.Tenant, error) {
	t, ok := tenant.From(ctx)
	if !ok || !t.IsActive {
		return nil, t, ErrForbidden
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, t, err
	}
	if _, err = tx.Exec(ctx, `SELECT set_config('app.tenant_id',$1,true)`, t.ID.String()); err == nil {
		_, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "access-invitations:"+t.ID.String())
	}
	if err != nil {
		_ = tx.Rollback(ctx)
		return nil, t, err
	}
	return tx, t, nil
}
func authority(ctx context.Context, tx pgx.Tx, t uuid.UUID, actor uuid.UUID) (Authority, error) {
	var a Authority
	err := tx.QueryRow(ctx, `SELECT
 (u.role='hod' OR EXISTS(SELECT 1 FROM user_role_assignments r WHERE r.tenant_id=u.tenant_id AND r.user_id=u.id AND r.role='hod' AND r.is_active)),
 ((u.role='admin' OR EXISTS(SELECT 1 FROM user_role_assignments r WHERE r.tenant_id=u.tenant_id AND r.user_id=u.id AND r.role='admin' AND r.is_active)) AND EXISTS(SELECT 1 FROM admin_permissions p WHERE p.tenant_id=u.tenant_id AND p.user_id=u.id AND p.is_active AND (p.expires_at IS NULL OR p.expires_at>now()) AND p.can_manage_users))
 FROM users u WHERE u.tenant_id=$1 AND u.id=$2 AND u.is_active AND u.is_approved AND u.deleted_at IS NULL`, t, actor).Scan(&a.HOD, &a.ManageUsers)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrForbidden
	}
	return a, err
}

const columns = `id,email,name,role,grants,status,bootstrap,requested_by,approved_by,accepted_by,expires_at,created_at,approved_at,accepted_at,last_sent_at,delivery_failed`

func scan(row pgx.Row) (Invitation, error) {
	var i Invitation
	var grants []byte
	err := row.Scan(&i.ID, &i.Email, &i.Name, &i.Role, &grants, &i.Status, &i.Bootstrap, &i.RequestedBy, &i.ApprovedBy, &i.AcceptedBy, &i.ExpiresAt, &i.CreatedAt, &i.ApprovedAt, &i.AcceptedAt, &i.LastSentAt, &i.DeliveryFailed)
	if err == nil {
		err = json.Unmarshal(grants, &i.Grants)
	}
	return i, err
}
func event(ctx context.Context, tx pgx.Tx, t uuid.UUID, id uuid.UUID, actor *uuid.UUID, action string) error {
	_, err := tx.Exec(ctx, `INSERT INTO access_invitation_events(tenant_id,invitation_id,actor_id,action) VALUES($1,$2,$3,$4)`, t, id, actor, action)
	return err
}
func hasHODHistory(ctx context.Context, tx pgx.Tx, t uuid.UUID) (bool, error) {
	var yes bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id=$1 AND role='hod') OR EXISTS(SELECT 1 FROM user_role_assignments WHERE tenant_id=$1 AND role='hod') OR EXISTS(SELECT 1 FROM role_assignment_logs WHERE tenant_id=$1 AND role='hod')`, t).Scan(&yes)
	return yes, err
}
func openConflict(ctx context.Context, tx pgx.Tx, tenantID uuid.UUID, i Invitation) error {
	var exists bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM access_invitations WHERE tenant_id=$1 AND id<>$2 AND status IN ('pending_approval','sent') AND ((email=$3 AND role=$4) OR (bootstrap AND $5)))`, tenantID, i.ID, i.Email, i.Role, i.Bootstrap).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		return ErrConflict
	}
	return nil
}
func bootstrapOpen(ctx context.Context, tx pgx.Tx, t uuid.UUID) error {
	if _, err := tx.Exec(ctx, `INSERT INTO department_onboarding(tenant_id) VALUES($1) ON CONFLICT DO NOTHING`, t); err != nil {
		return err
	}
	var done *time.Time
	if err := tx.QueryRow(ctx, `SELECT hod_bootstrapped_at FROM department_onboarding WHERE tenant_id=$1 FOR UPDATE`, t).Scan(&done); err != nil {
		return err
	}
	yes, err := hasHODHistory(ctx, tx, t)
	if err != nil {
		return err
	}
	if done != nil || yes {
		return ErrConflict
	}
	return nil
}

// Bootstrap is deliberately not exposed by the HTTP API. Only the trusted
// department-management CLI calls it, never a delegated administrator.
func (s *Service) Bootstrap(ctx context.Context, r Request) (Invitation, error) {
	r.Role = "hod"
	return s.create(ctx, uuid.Nil, r, true)
}
func (s *Service) Create(ctx context.Context, actor uuid.UUID, r Request) (Invitation, error) {
	return s.create(ctx, actor, r, false)
}
func (s *Service) create(ctx context.Context, actor uuid.UUID, r Request, bootstrap bool) (Invitation, error) {
	var empty Invitation
	r, err := Normalize(r)
	if err != nil {
		return empty, err
	}
	if _, err = FrontendOrigin(s.FrontendURL); err != nil {
		return empty, err
	}
	tx, t, err := s.begin(ctx)
	if err != nil {
		return empty, err
	}
	defer tx.Rollback(ctx)
	var requester, approver *uuid.UUID
	status := "pending_approval"
	if bootstrap {
		if err = bootstrapOpen(ctx, tx, t.ID); err != nil {
			return empty, err
		}
		status = "sent"
	} else {
		a, e := authority(ctx, tx, t.ID, actor)
		if e != nil {
			return empty, e
		}
		if !a.CanInvite() {
			return empty, ErrForbidden
		}
		requester = &actor
		if a.CanAuthorize(r.Role) {
			status = "sent"
			approver = &actor
		}
	}
	var count int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM access_invitations WHERE tenant_id=$1 AND created_at>now()-interval '1 hour'`, t.ID).Scan(&count); err != nil {
		return empty, err
	}
	if count >= 30 {
		return empty, ErrRateLimit
	}
	// Expired requests are retained for audit but no longer block a fresh invite.
	if _, err = tx.Exec(ctx, `WITH expired AS (UPDATE access_invitations SET status='expired',token_hash=NULL WHERE tenant_id=$1 AND status IN ('pending_approval','sent') AND expires_at<=now() RETURNING id,tenant_id) INSERT INTO access_invitation_events(tenant_id,invitation_id,action) SELECT tenant_id,id,'expired' FROM expired`, t.ID); err != nil {
		return empty, err
	}
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM access_invitations WHERE tenant_id=$1 AND status IN ('pending_approval','sent') AND ((email=$2 AND role=$3) OR (bootstrap AND $4)))`, t.ID, r.Email, r.Role, bootstrap).Scan(&exists); err != nil {
		return empty, err
	}
	if exists {
		return empty, ErrConflict
	}
	grants, _ := json.Marshal(r.Grants)
	token := ""
	var hash *string
	if status == "sent" {
		token, err = NewToken()
		if err != nil {
			return empty, err
		}
		h, _ := HashToken(token)
		hash = &h
	}
	i, err := scan(tx.QueryRow(ctx, `INSERT INTO access_invitations(tenant_id,email,name,role,grants,status,bootstrap,requested_by,approved_by,token_hash,expires_at,approved_at,send_count,last_sent_at,delivery_failed) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '72 hours',CASE WHEN $6='sent' THEN now() END,CASE WHEN $6='sent' THEN 1 ELSE 0 END,CASE WHEN $6='sent' THEN now() END,($6='sent')) RETURNING `+columns, t.ID, r.Email, r.Name, r.Role, grants, status, bootstrap, requester, approver, hash))
	if err != nil {
		return empty, err
	}
	if err = event(ctx, tx, t.ID, i.ID, requester, "created"); err != nil {
		return empty, err
	}
	if err = tx.Commit(ctx); err != nil {
		return empty, err
	}
	if status == "sent" {
		i.DeliveryFailed = s.deliver(ctx, t, i, token) != nil
	} else {
		s.notifyApproval(ctx, t, i)
	}
	return i, nil
}
func (s *Service) List(ctx context.Context, actor uuid.UUID) ([]Invitation, error) {
	tx, t, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	a, err := authority(ctx, tx, t.ID, actor)
	if err != nil {
		return nil, err
	}
	if !a.CanInvite() {
		return nil, ErrForbidden
	}
	rows, err := tx.Query(ctx, `SELECT `+columns+` FROM access_invitations WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100`, t.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Invitation{}
	for rows.Next() {
		i, e := scan(rows)
		if e != nil {
			return nil, e
		}
		if (i.Status == "sent" || i.Status == "pending_approval") && time.Now().After(i.ExpiresAt) {
			i.Status = "expired"
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// Act rechecks live database authority, not stale role claims. Resends rotate the
// token and extend expiry; they cannot authorize a pending privileged request.
func (s *Service) Act(ctx context.Context, actor uuid.UUID, id uuid.UUID, action string) (Invitation, error) {
	var empty Invitation
	tx, t, err := s.begin(ctx)
	if err != nil {
		return empty, err
	}
	defer tx.Rollback(ctx)
	a, err := authority(ctx, tx, t.ID, actor)
	if err != nil {
		return empty, err
	}
	if !a.CanInvite() {
		return empty, ErrForbidden
	}
	i, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM access_invitations WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, t.ID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return empty, ErrInvalid
	}
	if err != nil {
		return empty, err
	}
	if i.Status == "accepted" || i.Status == "revoked" {
		return empty, ErrInvalid
	}
	own := i.RequestedBy != nil && *i.RequestedBy == actor
	if action == "revoke" {
		if !a.HOD && !own {
			return empty, ErrForbidden
		}
		_, err = tx.Exec(ctx, `UPDATE access_invitations SET status='revoked',token_hash=NULL WHERE tenant_id=$1 AND id=$2`, t.ID, id)
		if err != nil {
			return empty, err
		}
		i.Status = "revoked"
	} else if action == "approve" || action == "resend" {
		if i.Bootstrap {
			return empty, ErrForbidden
		} // operator resends bootstrap through its dedicated CLI
		if action == "approve" {
			if !a.HOD || i.Status != "pending_approval" || time.Now().After(i.ExpiresAt) {
				return empty, ErrForbidden
			}
			i.ApprovedBy = &actor
		} else {
			if (i.Status != "sent" && i.Status != "expired") || (!a.HOD && !own) {
				return empty, ErrForbidden
			}
		}
		if i.ApprovedBy == nil {
			return empty, ErrForbidden
		}
		auth, e := authority(ctx, tx, t.ID, *i.ApprovedBy)
		if e != nil || !auth.CanAuthorize(i.Role) {
			return empty, ErrForbidden
		}
		if err = openConflict(ctx, tx, t.ID, i); err != nil {
			return empty, err
		}
		var limited bool
		err = tx.QueryRow(ctx, `SELECT COALESCE(last_sent_at>now()-interval '1 minute',false) OR (send_window_at>now()-interval '1 hour' AND send_count>=5) FROM access_invitations WHERE tenant_id=$1 AND id=$2`, t.ID, id).Scan(&limited)
		if err != nil {
			return empty, err
		}
		if limited {
			return empty, ErrRateLimit
		}
		token, e := NewToken()
		if e != nil {
			return empty, e
		}
		hash, _ := HashToken(token)
		i, err = scan(tx.QueryRow(ctx, `UPDATE access_invitations SET status='sent',approved_by=$3,approved_at=COALESCE(approved_at,now()),expires_at=now()+interval '72 hours',token_hash=$4,last_sent_at=now(),delivery_failed=true,send_count=CASE WHEN send_window_at<now()-interval '1 hour' THEN 1 ELSE send_count+1 END,send_window_at=CASE WHEN send_window_at<now()-interval '1 hour' THEN now() ELSE send_window_at END WHERE tenant_id=$1 AND id=$2 RETURNING `+columns, t.ID, id, i.ApprovedBy, hash))
		if err != nil {
			return empty, err
		}
		if err = event(ctx, tx, t.ID, id, &actor, action); err != nil {
			return empty, err
		}
		if err = tx.Commit(ctx); err != nil {
			return empty, err
		}
		i.DeliveryFailed = s.deliver(ctx, t, i, token) != nil
		return i, nil
	} else {
		return empty, ErrInvalid
	}
	if err = event(ctx, tx, t.ID, id, &actor, action); err != nil {
		return empty, err
	}
	if err = tx.Commit(ctx); err != nil {
		return empty, err
	}
	return i, nil
}
func (s *Service) deliver(ctx context.Context, t tenant.Tenant, i Invitation, token string) error {
	origin, err := FrontendOrigin(s.FrontendURL)
	if err != nil {
		return err
	}
	fragment := url.Values{"token": {token}, "tenant": {t.Slug}}.Encode()
	link := origin + "/accept-invitation#" + fragment
	body := fmt.Sprintf("You have been invited to %s as %s.\n\nAccept your invitation: %s\n\nThis single-use link expires in 72 hours. Opening it does not activate access. If you did not expect this invitation, ignore it.", t.Name, i.Role, link)
	if s.Sender == nil {
		err = errors.New("email sender unavailable")
	} else {
		err = s.Sender.SendEmailFrom(t.Name, []string{i.Email}, "Your department access invitation", body, false)
	}
	tx, _, e := s.begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	hash, _ := HashToken(token)
	tag, e := tx.Exec(ctx, `UPDATE access_invitations SET delivery_failed=$3 WHERE tenant_id=$1 AND id=$2 AND token_hash=$4`, t.ID, i.ID, err != nil, hash)
	if e != nil {
		return e
	}
	if tag.RowsAffected() > 0 {
		action := "email_sent"
		if err != nil {
			action = "email_failed"
		}
		if e = event(ctx, tx, t.ID, i.ID, nil, action); e != nil {
			return e
		}
	}
	if e = tx.Commit(ctx); e != nil {
		return e
	}
	return err
}
func (s *Service) notifyApproval(ctx context.Context, t tenant.Tenant, i Invitation) {
	if s.Sender == nil {
		return
	}
	origin, err := FrontendOrigin(s.FrontendURL)
	if err != nil {
		return
	}
	tx, _, err := s.begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `SELECT DISTINCT u.email FROM users u WHERE u.tenant_id=$1 AND u.is_active AND u.is_approved AND u.deleted_at IS NULL AND (u.role='hod' OR EXISTS(SELECT 1 FROM user_role_assignments r WHERE r.tenant_id=u.tenant_id AND r.user_id=u.id AND r.role='hod' AND r.is_active))`, t.ID)
	if err != nil {
		return
	}
	recipients := []string{}
	for rows.Next() {
		var e string
		if rows.Scan(&e) != nil {
			return
		}
		recipients = append(recipients, e)
	}
	rows.Close()
	_ = tx.Rollback(ctx)
	for _, e := range recipients {
		_ = s.Sender.SendEmailFrom(t.Name, []string{e}, "Access invitation awaiting your approval", fmt.Sprintf("An invitation for %s (%s) as %s needs HOD approval. Review the requested role and grants at %s%s/invitations. No access link has been sent to the recipient.", i.Name, i.Email, i.Role, origin, adminPath(t)), false)
	}
}
func adminPath(t tenant.Tenant) string {
	if t.URLCode != "" {
		return "/" + t.URLCode + "/admin"
	}
	return "/admin"
}
