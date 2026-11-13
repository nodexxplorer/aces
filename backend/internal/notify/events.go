// Package notify atomically records notification history and durable delivery jobs.
package notify

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"time"
)

type Beginner interface {
	Begin(context.Context) (pgx.Tx, error)
}
type Event struct {
	UserID      uuid.UUID              `json:"user_id"`
	Key         string                 `json:"key"`
	Type        string                 `json:"type"`
	Category    string                 `json:"category"`
	Priority    string                 `json:"priority"`
	Title       string                 `json:"title"`
	Message     string                 `json:"message"`
	ActionURL   string                 `json:"action_url"`
	ActionLabel string                 `json:"action_label"`
	SenderID    *uuid.UUID             `json:"sender_id,omitempty"`
	EntityType  *string                `json:"entity_type,omitempty"`
	EntityID    *uuid.UUID             `json:"entity_id,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	// Conversation authorization is rechecked before external delivery.
	TargetKind string    `json:"target_kind,omitempty"`
	TargetID   uuid.UUID `json:"target_id,omitempty"`
}

func Preferences(ctx context.Context, q *db.Queries, user uuid.UUID) (db.NotificationPreferenceView, error) {
	p, err := q.GetNotificationPreferences(ctx, user)
	if errors.Is(err, pgx.ErrNoRows) {
		return q.UpsertNotificationPreferences(ctx, db.UpsertNotificationPreferencesParams{UserID: user})
	}
	return p, err
}
func Enqueue(ctx context.Context, pool Beginner, e Event) (db.NotificationFull, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return db.NotificationFull{}, err
	}
	defer tx.Rollback(ctx)
	n, err := EnqueueTx(ctx, tx, e)
	if err != nil {
		return n, err
	}
	return n, tx.Commit(ctx)
}
func EnqueueTx(ctx context.Context, tx pgx.Tx, e Event) (db.NotificationFull, error) {
	var n db.NotificationFull
	t, ok := tenant.IDFrom(ctx)
	if !ok || e.UserID == uuid.Nil {
		return n, errors.New("notification requires tenant and recipient")
	}
	if e.Key == "" {
		e.Key = uuid.NewString()
	}
	if len(e.Key) > 300 || len(e.Title) > 255 || len(e.Message) > 32000 {
		return n, errors.New("notification too large")
	}
	if e.Type == "" {
		e.Type = "general"
	}
	if e.Category == "" {
		e.Category = "system"
	}
	if e.Priority == "" {
		e.Priority = "normal"
	}
	// Older producers used type labels not present in the database enum.
	switch e.Type {
	case "general", "result_published", "payment_due", "complaint_resolved", "assignment_graded", "deadline_reminder", "exam_conflict", "profile_approved", "announcement":
	default:
		e.Type = "general"
	}
	q := db.New(tx)
	p, err := Preferences(ctx, q, e.UserID)
	if err != nil {
		return n, err
	}
	payload, err := json.Marshal(e)
	if err != nil {
		return n, err
	}
	var id uuid.UUID
	err = tx.QueryRow(ctx, `INSERT INTO notification_events(tenant_id,user_id,event_key,payload)VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,user_id,event_key)DO NOTHING RETURNING id`, t, e.UserID, e.Key, payload).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		var old *uuid.UUID
		err = tx.QueryRow(ctx, `SELECT notification_id FROM notification_events WHERE tenant_id=$1 AND user_id=$2 AND event_key=$3`, t, e.UserID, e.Key).Scan(&old)
		if err == nil && old != nil {
			return q.GetNotificationFull(ctx, *old)
		}
		return n, err
	}
	if err != nil {
		return n, err
	}
	job := func(channel string, device any) error {
		_, err := tx.Exec(ctx, `INSERT INTO notification_deliveries(tenant_id,event_id,channel,device_id)VALUES($1,$2,$3,$4)`, t, id, channel, device)
		return err
	}
	if p.InAppEnabled {
		n, err = q.CreateNotificationFull(ctx, db.CreateNotificationFullParams{UserID: e.UserID, Type: e.Type, Title: e.Title, Message: e.Message, ActionURL: &e.ActionURL, Category: e.Category, Priority: e.Priority, SenderID: e.SenderID, EntityType: e.EntityType, EntityID: e.EntityID, ActionLabel: &e.ActionLabel, Metadata: e.Metadata})
		if err != nil {
			return n, err
		}
		if _, err = tx.Exec(ctx, `UPDATE notification_events SET notification_id=$3 WHERE tenant_id=$1 AND id=$2`, t, id, n.ID); err != nil {
			return n, err
		}
		if err = job("in_app", nil); err != nil {
			return n, err
		}
	}
	if p.EmailEnabled && EmailAllowed(p, e.Category) {
		if err = job("email", nil); err != nil {
			return n, err
		}
	}
	if p.PushEnabled && PushAllowed(p, e.Category) {
		rows, err := tx.Query(ctx, `SELECT id FROM notification_devices WHERE tenant_id=$1 AND user_id=$2 AND active`, t, e.UserID)
		if err != nil {
			return n, err
		}
		ids := []uuid.UUID{}
		for rows.Next() {
			var device uuid.UUID
			if err = rows.Scan(&device); err != nil {
				rows.Close()
				return n, err
			}
			ids = append(ids, device)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return n, err
		}
		for _, device := range ids {
			if err = job("push", device); err != nil {
				return n, err
			}
		}
	}
	return n, nil
}
func EmailAllowed(p db.NotificationPreferenceView, c string) bool {
	switch c {
	case "auth":
		return p.EmailAuth
	case "results":
		return p.EmailResults
	case "dues":
		return p.EmailDues
	case "messages":
		return p.EmailMessages
	case "connect":
		return p.EmailConnect
	case "skills":
		return p.EmailSkills
	case "alumni":
		return p.EmailAlumni
	default:
		return p.EmailSystem
	}
}
func PushAllowed(p db.NotificationPreferenceView, c string) bool {
	switch c {
	case "auth":
		return p.PushAuth
	case "results":
		return p.PushResults
	case "dues":
		return p.PushDues
	case "messages":
		return p.PushMessages
	case "connect":
		return p.PushConnect
	case "skills":
		return p.PushSkills
	case "alumni":
		return p.PushAlumni
	default:
		return p.PushSystem
	}
}

// Quiet hours use Africa/Lagos (UTC+1). Equal start/end means disabled.
// Security/auth alerts bypass quiet hours, never the user's channel switches.
func QuietUntil(now time.Time, p db.NotificationPreferenceView, category string) time.Time {
	if category == "auth" || p.QuietHoursStart == nil || p.QuietHoursEnd == nil {
		return now
	}
	minutes := func(s string) (int, bool) {
		var h, m int
		if _, err := fmt.Sscanf(s, "%d:%d", &h, &m); err != nil || h < 0 || h > 23 || m < 0 || m > 59 {
			return 0, false
		}
		return h*60 + m, true
	}
	start, a := minutes(*p.QuietHoursStart)
	end, b := minutes(*p.QuietHoursEnd)
	if !a || !b || start == end {
		return now
	}
	local := now.In(time.FixedZone("Africa/Lagos", 3600))
	minute := local.Hour()*60 + local.Minute()
	quiet := start < end && minute >= start && minute < end || start > end && (minute >= start || minute < end)
	if !quiet {
		return now
	}
	finish := time.Date(local.Year(), local.Month(), local.Day(), end/60, end%60, 0, 0, local.Location())
	if !finish.After(local) {
		finish = finish.AddDate(0, 0, 1)
	}
	return finish
}
