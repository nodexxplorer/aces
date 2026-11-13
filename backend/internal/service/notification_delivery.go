package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/aces/backend/internal/notify"
	"github.com/aces/backend/internal/push"
	"github.com/aces/backend/internal/tenant"
	"github.com/aces/backend/internal/ws"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"time"
)

// ProcessPending claims jobs with leases. Safe with several Railway replicas.
// Transport acceptance is not proof that a person received/read the message.
func (s *NotificationServiceFull) ProcessPending(ctx context.Context, limit int) error {
	for i := 0; i < limit; i++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if ok, err := s.processOne(ctx); err != nil {
			return err
		} else if !ok {
			return nil
		}
	}
	return nil
}
func (s *NotificationServiceFull) processOne(ctx context.Context) (bool, error) {
	t, ok := tenant.IDFrom(ctx)
	if !ok {
		return false, errors.New("notification worker requires tenant")
	}
	lease := uuid.NewString() // stored as an opaque error marker to fence an expired worker
	var id uuid.UUID
	var channel string
	var device *uuid.UUID
	var eventID uuid.UUID
	var payload []byte
	var attempts int
	var notifID *uuid.UUID
	err := s.queries.GetDB().QueryRow(ctx, `WITH candidate AS(SELECT id FROM notification_deliveries WHERE tenant_id=$1 AND ((status='queued' AND next_attempt_at<=now())OR(status='processing' AND lease_until<now())) ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1), claimed AS(UPDATE notification_deliveries d SET status='processing',attempts=attempts+1,lease_until=now()+interval '2 minutes',last_error=$2,updated_at=now() FROM candidate c WHERE d.tenant_id=$1 AND d.id=c.id RETURNING d.*) SELECT c.id,c.channel,c.device_id,c.event_id,c.attempts,e.payload,e.notification_id FROM claimed c JOIN notification_events e ON e.tenant_id=c.tenant_id AND e.id=c.event_id`, t, lease).Scan(&id, &channel, &device, &eventID, &attempts, &payload, &notifID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	status := "accepted"
	reason := ""
	next := time.Now()
	var e notify.Event
	finish := func() error {
		_, err := s.queries.GetDB().Exec(ctx, `UPDATE notification_deliveries SET status=$3,last_error=NULLIF($4,''),next_attempt_at=$5,lease_until=NULL,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND status='processing' AND last_error=$6`, t, id, status, reason, next, lease)
		return err
	}
	if attempts > 6 {
		status = "failed"
		reason = "delivery lease retries exhausted"
		return true, finish()
	}
	if json.Unmarshal(payload, &e) != nil {
		status = "failed"
		reason = "invalid event payload"
		return true, finish()
	}
	p, err := notify.Preferences(ctx, s.queries, e.UserID)
	if err != nil {
		return true, s.retryJob(ctx, t, id, lease, attempts)
	}
	allowed := channel == "in_app" && p.InAppEnabled || channel == "email" && p.EmailEnabled && notify.EmailAllowed(p, e.Category) || channel == "push" && p.PushEnabled && notify.PushAllowed(p, e.Category)
	user, err := s.queries.GetUser(ctx, e.UserID)
	if err != nil {
		return true, s.retryJob(ctx, t, id, lease, attempts)
	}
	if !user.IsActive || user.DeletedAt.Valid {
		allowed = false
	}
	// Pending signup/approval users may receive their own security/welcome alerts.
	if e.TargetKind != "" {
		var eligible bool
		switch e.TargetKind {
		case "group":
			err = s.queries.GetDB().QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM group_members WHERE tenant_id=$1 AND group_id=$2 AND user_id=$3)`, t, e.TargetID, e.UserID).Scan(&eligible)
		case "dm":
			err = s.queries.GetDB().QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM connections WHERE tenant_id=$1 AND status='accepted' AND ((requester_id=$2 AND receiver_id=$3)OR(requester_id=$3 AND receiver_id=$2)))`, t, e.TargetID, e.UserID).Scan(&eligible)
		default:
			eligible = false
		}
		if err != nil {
			return true, s.retryJob(ctx, t, id, lease, attempts)
		}
		allowed = allowed && eligible && user.IsApproved
	}
	if !allowed {
		status = "skipped"
		reason = "preferences or recipient eligibility changed"
		return true, finish()
	}
	if channel != "in_app" {
		next = notify.QuietUntil(time.Now(), p, e.Category)
		if next.After(time.Now().Add(time.Second)) {
			status = "queued"
			_, err = s.queries.GetDB().Exec(ctx, `UPDATE notification_deliveries SET attempts=GREATEST(attempts-1,0) WHERE tenant_id=$1 AND id=$2 AND last_error=$3`, t, id, lease)
			if err != nil {
				return true, err
			}
			reason = "deferred: quiet hours (Africa/Lagos)"
			return true, finish()
		}
	}
	title, body := e.Title, e.Message
	if e.Category == "messages" {
		title = "New Connect message"
		body = "You have a new message. Open Connect to read it."
	}
	if e.EntityType != nil && *e.EntityType == "complaint" {
		title = "Complaint update"
		body = "There is an update to a complaint. Sign in to view it."
	}
	switch channel {
	case "in_app":
		if notifID != nil && s.wsHub != nil {
			n, x := s.queries.GetNotificationFull(ctx, *notifID)
			err = x
			if err == nil {
				s.wsHub.SendToUser(e.UserID, ws.TypeNotification, n)
			}
		}
	case "email":
		if s.emailSender == nil || user.Email == "" {
			status = "skipped"
			break
		}
		brand := s.brandFor(ctx, t)
		token, x := s.queries.GetOrCreateNotificationUnsubscribeToken(ctx, e.UserID)
		if x != nil {
			return true, s.retryJob(ctx, t, id, lease, attempts)
		}
		html := s.buildNotificationEmailHTML(brand, title, body, s.resolveAction(ctx, e.ActionURL), e.ActionLabel, s.frontendURL+"/notifications/unsubscribe/"+token)
		err = s.emailSender.SendEmailFrom(brand.Name, []string{user.Email}, title, html, true)
		if m, ok := s.emailSender.(interface{ Mock() bool }); ok && m.Mock() {
			status = "simulated"
		}
	case "push":
		if device == nil {
			status = "skipped"
			break
		}
		var platform, address string
		var subscription []byte
		err = s.queries.GetDB().QueryRow(ctx, `SELECT platform,address,subscription FROM notification_devices WHERE tenant_id=$1 AND id=$2 AND user_id=$3 AND active AND updated_at>now()-interval '30 days'`, t, *device, e.UserID).Scan(&platform, &address, &subscription)
		if errors.Is(err, pgx.ErrNoRows) {
			status = "skipped"
			err = nil
			break
		}
		if err != nil {
			break
		}
		data := map[string]interface{}{"action_url": s.resolveAction(ctx, e.ActionURL), "event_id": eventID.String(), "recipient_id": e.UserID.String(), "target_kind": e.TargetKind, "target_id": e.TargetID.String()}
		if current, ok := tenant.From(ctx); ok {
			data["tenant_slug"] = current.Slug
		}
		if platform == "web" {
			if s.webPush == nil {
				err = fmt.Errorf("web push unavailable")
			} else {
				err = s.webPush.Send(ctx, subscription, title, body, data)
				if s.webPush.Mock {
					status = "simulated"
				}
			}
		} else if s.pushSender == nil {
			err = fmt.Errorf("mobile push unavailable")
		} else {
			err = s.pushSender.SendPush(address, title, body, data)
			if m, ok := s.pushSender.(interface{ Mock() bool }); ok && m.Mock() {
				status = "simulated"
			}
		}
		if errors.Is(err, push.ErrUnregistered) {
			_, x := s.queries.GetDB().Exec(ctx, `UPDATE notification_devices SET active=false,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND user_id=$3`, t, *device, e.UserID)
			if x != nil {
				return true, x
			}
			status = "skipped"
			reason = "device registration expired"
			err = nil
		}
	}
	if err != nil {
		return true, s.retryJob(ctx, t, id, lease, attempts)
	}
	if channel == "email" && status == "accepted" && notifID != nil {
		_, err = s.queries.GetDB().Exec(ctx, `UPDATE notifications SET email_sent=true WHERE tenant_id=$1 AND id=$2`, t, *notifID)
		if err != nil {
			return true, err
		}
	}
	return true, finish()
}
func (s *NotificationServiceFull) retryJob(ctx context.Context, t, id uuid.UUID, lease string, attempts int) error {
	status := "queued"
	if attempts >= 6 {
		status = "failed"
	}
	delay := time.Duration(1<<min(attempts, 10)) * 30 * time.Second
	_, err := s.queries.GetDB().Exec(ctx, `UPDATE notification_deliveries SET status=$3,last_error='delivery attempt failed; inspect provider configuration',next_attempt_at=$4,lease_until=NULL,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND last_error=$5 AND status='processing'`, t, id, status, time.Now().Add(delay), lease)
	return err
}

// Tenant-aware web URL; never permit an external action redirect.
func (s *NotificationServiceFull) resolveAction(ctx context.Context, path string) string {
	if len(path) == 0 || path[0] != '/' || len(path) > 1 && path[1] == '/' {
		return s.frontendURL
	}

	return s.frontendURL + path
}
