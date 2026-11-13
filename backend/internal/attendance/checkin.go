package attendance

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
)

type CheckinRequest struct {
	Challenge string    `json:"challenge"`
	Device    string    `json:"device"`
	Location  *Location `json:"location"`
}

func (s *Service) Checkin(ctx context.Context, actor, id uuid.UUID, r CheckinRequest) (json.RawMessage, error) {
	if len(r.Device) < 32 || len(r.Device) > 200 || len(r.Challenge) > 100 {
		return nil, ErrInvalid
	}
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	x, err := load(ctx, tx, t, id)
	if err != nil {
		return nil, err
	}
	var submitted *time.Time
	err = tx.QueryRow(ctx, `SELECT submitted_at FROM attendance_v2_records WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3`, t, id, actor).Scan(&submitted)
	if err != nil {
		return nil, ErrForbidden
	}
	result := func() (json.RawMessage, error) {
		return jsonRows(ctx, tx, `SELECT to_jsonb(r)-'device_hash'-'tenant_id' FROM attendance_v2_records r WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3`, t, id, actor)
	}
	// Retry is safe after expiry/closure; it never changes an already-recorded decision.
	if submitted != nil {
		return result()
	}
	now := time.Now()
	if x.Status != "open" || x.ClosesAt == nil || !now.Before(*x.ClosesAt) {
		return nil, ErrConflict
	}
	if !ValidChallenge(x.Secret, id.String(), r.Challenge, now) {
		return nil, ErrChallenge
	}
	flags, distance := Presence(x.Latitude, x.Longitude, x.Radius, r.Location, now)
	deviceHash := hash(r.Device)
	_, err = tx.Exec(ctx, `INSERT INTO attendance_v2_devices(tenant_id,user_id,device_hash)VALUES($1,$2,$3)ON CONFLICT DO NOTHING`, t, actor, deviceHash)
	if err != nil {
		return nil, err
	}
	var approved, shared bool
	err = tx.QueryRow(ctx, `SELECT approved,EXISTS(SELECT 1 FROM attendance_v2_devices WHERE tenant_id=$1 AND device_hash=$3 AND user_id<>$2) FROM attendance_v2_devices WHERE tenant_id=$1 AND user_id=$2 AND device_hash=$3`, t, actor, deviceHash).Scan(&approved, &shared)
	if err != nil {
		return nil, err
	}
	if !approved {
		flags = append(flags, "device_unverified")
	}
	if shared {
		flags = append(flags, "device_shared")
	}
	verification := "verified"
	if len(flags) > 0 {
		verification = "flagged"
	}
	var accuracy *float64
	if distance != nil {
		accuracy = &r.Location.Accuracy
	}
	_, err = tx.Exec(ctx, `UPDATE attendance_v2_records SET verification=$4,outcome='present',flags=$5,submitted_at=now(),device_hash=$6,distance_m=$7,accuracy_m=$8,revision=revision+1 WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3`, t, id, actor, verification, flags, deviceHash, distance, accuracy)
	if err != nil {
		return nil, err
	}
	// Store derived evidence only, not precise student coordinates or the credential.
	if err = audit(ctx, tx, t, id, actor, "checkin", map[string]any{"verification": verification, "flags": flags, "distanceM": distance, "accuracyM": accuracy}); err != nil {
		return nil, err
	}
	out, err := result()
	if err != nil {
		return nil, err
	}
	return out, tx.Commit(ctx)
}

type ReviewRequest struct {
	UserID        uuid.UUID `json:"userId"`
	Outcome       string    `json:"outcome"`
	Reason        string    `json:"reason"`
	ApproveDevice bool      `json:"approveDevice"`
}

func (s *Service) Review(ctx context.Context, actor, id uuid.UUID, r ReviewRequest) error {
	if r.UserID == uuid.Nil || actor == r.UserID || len(strings.TrimSpace(r.Reason)) < 5 || len(r.Reason) > 2000 || (r.Outcome != "present" && r.Outcome != "late" && r.Outcome != "absent") {
		return ErrInvalid
	}
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	x, err := load(ctx, tx, t, id)
	if err != nil {
		return err
	}
	yes, err := owns(ctx, tx, t, actor, x)
	if err != nil {
		return err
	}
	if !yes {
		return ErrForbidden
	}
	if x.Status != "closed" && x.Status != "finalized" {
		return ErrConflict
	}
	before, err := jsonRows(ctx, tx, `SELECT to_jsonb(r)-'device_hash'-'tenant_id' FROM attendance_v2_records r WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3`, t, id, r.UserID)
	if err != nil {
		return ErrForbidden
	}
	verification := "approved"
	if r.Outcome == "absent" {
		verification = "rejected"
	}
	_, err = tx.Exec(ctx, `UPDATE attendance_v2_records SET outcome=$4,verification=$5,reviewed_by=$6,review_reason=$7,revision=revision+1 WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3`, t, id, r.UserID, r.Outcome, verification, actor, r.Reason)
	if err != nil {
		return err
	}
	if r.ApproveDevice && r.Outcome != "absent" {
		// Re-verification replaces prior approved credentials; shared credentials
		// will still be flagged during check-in. Historical evidence is preserved.
		_, err = tx.Exec(ctx, `UPDATE attendance_v2_devices SET approved=false WHERE tenant_id=$1 AND user_id=$2`, t, r.UserID)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE attendance_v2_devices d SET approved=true FROM attendance_v2_records r WHERE d.tenant_id=$1 AND d.user_id=$3 AND r.tenant_id=d.tenant_id AND r.session_id=$2 AND r.user_id=d.user_id AND d.device_hash=r.device_hash`, t, id, r.UserID)
		if err != nil {
			return err
		}
	}
	_, err = tx.Exec(ctx, `UPDATE attendance_v2_disputes SET status='resolved',resolution=$4,resolved_by=$5,resolved_at=now() WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3 AND status='open'`, t, id, r.UserID, r.Reason, actor)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE attendance_v2_sessions SET revision=revision+1 WHERE tenant_id=$1 AND id=$2`, t, id)
	if err != nil {
		return err
	}
	if err = audit(ctx, tx, t, id, actor, "record_review", map[string]any{"before": before, "decision": r}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Service) Dispute(ctx context.Context, actor, id uuid.UUID, reason string) error {
	if len(strings.TrimSpace(reason)) < 5 || len(reason) > 2000 {
		return ErrInvalid
	}
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	x, err := load(ctx, tx, t, id)
	if err != nil {
		return err
	}
	if x.Status != "closed" && x.Status != "finalized" {
		return ErrConflict
	}
	var allowed bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM attendance_v2_records WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3) AND NOT EXISTS(SELECT 1 FROM attendance_v2_disputes WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3 AND status='open')`, t, id, actor).Scan(&allowed)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrConflict
	}
	var attempts int
	err = tx.QueryRow(ctx, `SELECT count(*) FROM attendance_v2_disputes WHERE tenant_id=$1 AND user_id=$2 AND created_at>now()-interval '1 hour'`, t, actor).Scan(&attempts)
	if err != nil {
		return err
	}
	if attempts >= 10 {
		return ErrLimit
	}
	_, err = tx.Exec(ctx, `INSERT INTO attendance_v2_disputes(tenant_id,session_id,user_id,reason)VALUES($1,$2,$3,$4)`, t, id, actor, reason)
	if err != nil {
		return err
	}
	if err = audit(ctx, tx, t, id, actor, "dispute_opened", map[string]string{"reason": reason}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
