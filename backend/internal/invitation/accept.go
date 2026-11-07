package invitation

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/aces/backend/internal/util"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Preview struct {
	InvitedBy     string     `json:"invitedBy"`
	ApprovedBy    string     `json:"approvedBy"`
	Invitation    Invitation `json:"invitation"`
	Department    string     `json:"department"`
	URLCode       string     `json:"urlCode"`
	AccountExists bool       `json:"accountExists"`
}
type AcceptRequest struct {
	Token     string `json:"token"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Password  string `json:"password"`
}

func live(ctx context.Context, tx pgx.Tx, tenantID uuid.UUID, i Invitation) error {
	if i.Status != "sent" || time.Now().After(i.ExpiresAt) {
		return ErrInvalid
	}
	if i.Bootstrap {
		return bootstrapOpen(ctx, tx, tenantID)
	}
	if i.ApprovedBy == nil {
		return ErrInvalid
	}
	a, err := authority(ctx, tx, tenantID, *i.ApprovedBy)
	if err != nil {
		return ErrForbidden
	}
	if !a.CanAuthorize(i.Role) {
		return ErrForbidden
	}
	return nil
}
func (s *Service) Inspect(ctx context.Context, token string) (Preview, error) {
	var p Preview
	hash, err := HashToken(token)
	if err != nil {
		return p, err
	}
	tx, t, err := s.begin(ctx)
	if err != nil {
		return p, err
	}
	defer tx.Rollback(ctx)
	i, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM access_invitations WHERE tenant_id=$1 AND token_hash=$2`, t.ID, hash))
	if errors.Is(err, pgx.ErrNoRows) {
		return p, ErrInvalid
	}
	if err != nil {
		return p, err
	}
	if err = live(ctx, tx, t.ID, i); err != nil {
		return p, err
	}
	p = Preview{Invitation: i, Department: t.Name, URLCode: t.URLCode, InvitedBy: "Department setup operator", ApprovedBy: "Department setup operator"}
	if i.RequestedBy != nil {
		if err = tx.QueryRow(ctx, `SELECT full_name FROM users WHERE tenant_id=$1 AND id=$2`, t.ID, *i.RequestedBy).Scan(&p.InvitedBy); err != nil {
			return p, err
		}
	}
	if i.ApprovedBy != nil {
		if err = tx.QueryRow(ctx, `SELECT full_name FROM users WHERE tenant_id=$1 AND id=$2`, t.ID, *i.ApprovedBy).Scan(&p.ApprovedBy); err != nil {
			return p, err
		}
	}
	// Do not expose internal actor IDs on the public link-preview endpoint.
	i.RequestedBy = nil
	i.ApprovedBy = nil
	i.AcceptedBy = nil
	p.Invitation = i
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id=$1 AND lower(email)=$2)`, t.ID, i.Email).Scan(&p.AccountExists)
	return p, err
}

// Accept atomically establishes identity, role, grant, audit and consumption.
// Existing accounts require their authenticated session: possession of an invite
// never resets a password or takes over an existing account.
func (s *Service) Accept(ctx context.Context, actor *uuid.UUID, r AcceptRequest) (uuid.UUID, error) {
	hash, err := HashToken(r.Token)
	if err != nil {
		return uuid.Nil, err
	}
	// Hash outside the transaction; the token is still rechecked under lock below.
	var passwordHash string
	if r.Password != "" {
		if _, err := s.Inspect(ctx, r.Token); err != nil {
			return uuid.Nil, err
		}
		if len(r.Password) < 12 || len(r.Password) > 72 {
			return uuid.Nil, ErrInvalid
		}
		passwordHash, err = util.HashPassword(r.Password)
		if err != nil {
			return uuid.Nil, err
		}
	}
	tx, t, err := s.begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)
	i, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM access_invitations WHERE tenant_id=$1 AND token_hash=$2 FOR UPDATE`, t.ID, hash))
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrInvalid
	}
	if err != nil {
		return uuid.Nil, err
	}
	if err = live(ctx, tx, t.ID, i); err != nil {
		return uuid.Nil, err
	}
	var userID uuid.UUID
	var active bool
	var deleted *time.Time
	err = tx.QueryRow(ctx, `SELECT id,is_active,deleted_at FROM users WHERE tenant_id=$1 AND lower(email)=$2 FOR UPDATE`, t.ID, i.Email).Scan(&userID, &active, &deleted)
	switch {
	case err == nil:
		if actor == nil {
			return uuid.Nil, ErrSignIn
		}
		if *actor != userID || !active || deleted != nil {
			return uuid.Nil, ErrForbidden
		}
	case errors.Is(err, pgx.ErrNoRows):
		if actor != nil {
			return uuid.Nil, ErrForbidden
		}
		first, last := strings.TrimSpace(r.FirstName), strings.TrimSpace(r.LastName)
		if passwordHash == "" || first == "" || last == "" || len(first) > 80 || len(last) > 80 {
			return uuid.Nil, ErrInvalid
		}
		rawRole := i.Role
		if rawRole == "delegated_admin" {
			rawRole = "admin"
		}
		err = tx.QueryRow(ctx, `INSERT INTO users(tenant_id,email,password_hash,role,first_name,last_name,is_active,is_approved,email_verified) VALUES($1,$2,$3,$4::user_role,$5,$6,true,true,true) RETURNING id`, t.ID, i.Email, passwordHash, rawRole, first, last).Scan(&userID)
		if err != nil {
			return uuid.Nil, err
		}
	default:
		return uuid.Nil, err
	}
	grantor := i.ApprovedBy
	if i.Bootstrap {
		grantor = &userID
	}
	rawRole := i.Role
	if rawRole == "delegated_admin" {
		rawRole = "admin"
	}
	if _, err = tx.Exec(ctx, `INSERT INTO user_role_assignments(tenant_id,user_id,role,is_active,assigned_by) VALUES($1,$2,$3::user_role,true,$4) ON CONFLICT(tenant_id,user_id,role) DO UPDATE SET is_active=true,assigned_by=EXCLUDED.assigned_by,assigned_at=now(),revoked_at=NULL`, t.ID, userID, rawRole, grantor); err != nil {
		return uuid.Nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET email_verified=true,is_approved=true,approved_by=$3,approved_at=now(),updated_at=now() WHERE tenant_id=$1 AND id=$2`, t.ID, userID, grantor); err != nil {
		return uuid.Nil, err
	}
	if i.Role == "delegated_admin" {
		// Exactly the HOD-approved grant set replaces any previous admin grant.
		columnsSQL := strings.Join(GrantKeys, ",")
		values := []string{}
		updates := []string{}
		for _, k := range GrantKeys {
			values = append(values, "COALESCE(($3::jsonb->>'"+k+"')::boolean,false)")
			updates = append(updates, k+"=EXCLUDED."+k)
		}
		grants, _ := json.Marshal(i.Grants)
		_, err = tx.Exec(ctx, `INSERT INTO admin_permissions(tenant_id,user_id,`+columnsSQL+`,granted_by_hod_id,is_active) VALUES($1,$2,`+strings.Join(values, ",")+`,$4,true) ON CONFLICT(tenant_id,user_id) DO UPDATE SET `+strings.Join(updates, ",")+`,granted_by_hod_id=EXCLUDED.granted_by_hod_id,granted_at=now(),expires_at=NULL,is_active=true`, t.ID, userID, grants, grantor)
		if err != nil {
			return uuid.Nil, err
		}
	}
	if i.Role == "lecturer" {
		_, err = tx.Exec(ctx, `INSERT INTO staff(tenant_id,user_id,staff_id,department) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,user_id) DO NOTHING`, t.ID, userID, "INV-"+userID.String(), t.Name)
		if err != nil {
			return uuid.Nil, err
		}
	}
	if i.Role == "hod" {
		_, err = tx.Exec(ctx, `INSERT INTO department_onboarding(tenant_id,hod_bootstrapped_at) VALUES($1,now()) ON CONFLICT(tenant_id) DO UPDATE SET hod_bootstrapped_at=COALESCE(department_onboarding.hod_bootstrapped_at,now())`, t.ID)
		if err != nil {
			return uuid.Nil, err
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE access_invitations SET status='accepted',accepted_by=$3,accepted_at=now(),token_hash=NULL WHERE tenant_id=$1 AND id=$2`, t.ID, i.ID, userID); err != nil {
		return uuid.Nil, err
	}
	if err = event(ctx, tx, t.ID, i.ID, &userID, "accepted"); err != nil {
		return uuid.Nil, err
	}
	// Invitation events preserve request/approval/acceptance actors; the existing
	// role log also shows the newly granted role in the department's role history.
	_, err = tx.Exec(ctx, `INSERT INTO role_assignment_logs(tenant_id,user_id,role,action,performed_by,performed_by_role,reason) VALUES($1,$2,$3::user_role,'assigned',$4,$5,$6)`, t.ID, userID, rawRole, grantor, "invitation", "Accepted access invitation "+i.ID.String())
	if err != nil {
		return uuid.Nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return uuid.Nil, err
	}
	return userID, nil
}

// BootstrapResend is operator-only, just like Bootstrap. It rotates or revokes
// the setup token but never reopens bootstrap after a HOD has been established.
func (s *Service) BootstrapResend(ctx context.Context, id uuid.UUID, revoke bool) (Invitation, error) {
	var empty Invitation
	tx, t, err := s.begin(ctx)
	if err != nil {
		return empty, err
	}
	defer tx.Rollback(ctx)
	if err = bootstrapOpen(ctx, tx, t.ID); err != nil {
		return empty, err
	}
	i, err := scan(tx.QueryRow(ctx, `SELECT `+columns+` FROM access_invitations WHERE tenant_id=$1 AND id=$2 AND bootstrap AND status IN ('sent','expired') FOR UPDATE`, t.ID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return empty, ErrInvalid
	}
	if err != nil {
		return empty, err
	}
	action := "operator_revoked"
	token := ""
	if revoke {
		_, err = tx.Exec(ctx, `UPDATE access_invitations SET status='revoked',token_hash=NULL WHERE tenant_id=$1 AND id=$2`, t.ID, id)
		i.Status = "revoked"
	} else {
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
		token, err = NewToken()
		if err != nil {
			return empty, err
		}
		h, _ := HashToken(token)
		action = "operator_resent"
		i, err = scan(tx.QueryRow(ctx, `UPDATE access_invitations SET token_hash=$3,expires_at=now()+interval '72 hours',last_sent_at=now(),delivery_failed=true,send_count=CASE WHEN send_window_at<now()-interval '1 hour' THEN 1 ELSE send_count+1 END,send_window_at=CASE WHEN send_window_at<now()-interval '1 hour' THEN now() ELSE send_window_at END WHERE tenant_id=$1 AND id=$2 RETURNING `+columns, t.ID, id, h))
	}
	if err != nil {
		return empty, err
	}
	if err = event(ctx, tx, t.ID, id, nil, action); err != nil {
		return empty, err
	}
	if err = tx.Commit(ctx); err != nil {
		return empty, err
	}
	if !revoke {
		i.DeliveryFailed = s.deliver(ctx, t, i, token) != nil
	}
	return i, nil
}
