package connectmedia

import (
	"context"
	"encoding/json"
	"github.com/aces/backend/internal/notify"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SendRequest struct {
	ReceiverID  uuid.UUID   `json:"receiver_id"`
	Content     string      `json:"content"`
	Attachments []uuid.UUID `json:"attachments"`
	Nonce       uuid.UUID   `json:"client_nonce"`
}

const attachmentsJSON = `COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'mime',a.mime,'bytes',a.bytes,'width',a.width,'height',a.height,'duration_seconds',a.duration_seconds) ORDER BY a.created_at,a.id) FROM connect_media a WHERE a.tenant_id=m.tenant_id AND (a.message_id=m.id OR a.group_message_id=m.id) AND a.state='ready'),'[]')`

func messageJSON(kind string) string {
	table := "messages"
	if kind == "group" {
		table = "group_messages"
	}
	return `SELECT (to_jsonb(m)-'tenant_id')||jsonb_build_object('attachments',` + attachmentsJSON + `,'full_name',u.full_name,'avatar_url',u.avatar_url) FROM ` + table + ` m JOIN users u ON u.tenant_id=m.tenant_id AND u.id=m.sender_id WHERE m.tenant_id=$1 AND m.id=$2`
}
func (s *Service) Send(ctx context.Context, actor uuid.UUID, target Target, r SendRequest) (json.RawMessage, bool, error) {
	r.Content = strings.TrimSpace(r.Content)
	if utf8.RuneCountInString(r.Content) > 8000 || len(r.Attachments) > 4 || (r.Content == "" && len(r.Attachments) == 0) {
		return nil, false, ErrInvalid
	}
	if r.Nonce == uuid.Nil {
		r.Nonce = uuid.New()
	}
	seen := map[uuid.UUID]bool{}
	for _, id := range r.Attachments {
		if id == uuid.Nil || seen[id] {
			return nil, false, ErrInvalid
		}
		seen[id] = true
	}
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return nil, false, err
	}
	defer tx.Rollback(ctx)
	if err = authorize(ctx, tx, t, actor, target); err != nil {
		return nil, false, err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, t.String()+":connect:"+actor.String()); err != nil {
		return nil, false, err
	}
	table, col, attachCol := "messages", "receiver_id", "message_id"
	if target.Kind == "group" {
		table, col, attachCol = "group_messages", "group_id", "group_message_id"
	}
	var oldID, oldTarget uuid.UUID
	var oldText string
	err = tx.QueryRow(ctx, `SELECT id,`+col+`,content FROM `+table+` WHERE tenant_id=$1 AND sender_id=$2 AND client_nonce=$3`, t, actor, r.Nonce).Scan(&oldID, &oldTarget, &oldText)
	content := r.Content
	if content == "" && len(r.Attachments) > 0 {
		content = "📷 Photo"
		if len(r.Attachments) == 1 {
			var kind string
			_ = tx.QueryRow(ctx, `SELECT kind FROM connect_media WHERE tenant_id=$1 AND id=$2`, t, r.Attachments[0]).Scan(&kind)
			if kind == "voice" {
				content = "🎙 Voice note"
			}
		}
	}
	if err == nil {
		if oldTarget != target.ID || oldText != content {
			return nil, false, ErrConflict
		}
		var ids []uuid.UUID
		if e := tx.QueryRow(ctx, `SELECT COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) FROM connect_media WHERE tenant_id=$1 AND `+attachCol+`=$2`, t, oldID).Scan(&ids); e != nil {
			return nil, false, e
		}
		if len(ids) != len(seen) {
			return nil, false, ErrConflict
		}
		for _, id := range ids {
			if !seen[id] {
				return nil, false, ErrConflict
			}
		}
		data, e := jsonRow(ctx, tx, messageJSON(target.Kind), t, oldID)
		return data, false, e
	}
	if err != pgx.ErrNoRows {
		return nil, false, err
	}
	voice := 0
	for _, id := range r.Attachments {
		var owner, targetID uuid.UUID
		var targetKind, kind, state string
		var attached bool
		err = tx.QueryRow(ctx, `SELECT owner_id,target_kind,target_id,kind,state,(message_id IS NOT NULL OR group_message_id IS NOT NULL) FROM connect_media WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, t, id).Scan(&owner, &targetKind, &targetID, &kind, &state, &attached)
		if err != nil || owner != actor || targetKind != target.Kind || targetID != target.ID {
			return nil, false, ErrForbidden
		}
		if state != "ready" || attached {
			return nil, false, ErrConflict
		}
		if kind == "voice" {
			voice++
		}
	}
	if voice > 0 && len(r.Attachments) != 1 {
		return nil, false, ErrInvalid
	}
	var messageID uuid.UUID
	err = tx.QueryRow(ctx, `INSERT INTO `+table+`(tenant_id,sender_id,`+col+`,content,client_nonce)VALUES($1,$2,$3,$4,$5) RETURNING id`, t, actor, target.ID, content, r.Nonce).Scan(&messageID)
	if err != nil {
		return nil, false, err
	}
	for _, id := range r.Attachments {
		if _, err = tx.Exec(ctx, `UPDATE connect_media SET `+attachCol+`=$3 WHERE tenant_id=$1 AND id=$2`, t, id, messageID); err != nil {
			return nil, false, err
		}
	}
	recipients := []uuid.UUID{target.ID}
	if target.Kind == "group" {
		recipients = nil
		rows, e := tx.Query(ctx, `SELECT gm.user_id FROM group_members gm JOIN users u ON u.tenant_id=gm.tenant_id AND u.id=gm.user_id WHERE gm.tenant_id=$1 AND gm.group_id=$2 AND gm.user_id<>$3 AND u.is_active AND u.is_approved AND u.deleted_at IS NULL ORDER BY gm.user_id`, t, target.ID, actor)
		if e != nil {
			return nil, false, e
		}
		for rows.Next() {
			var id uuid.UUID
			if e = rows.Scan(&id); e != nil {
				rows.Close()
				return nil, false, e
			}
			recipients = append(recipients, id)
		}
		e = rows.Err()
		rows.Close()
		if e != nil {
			return nil, false, e
		}
	}
	entityType := "message"
	for _, recipient := range recipients {
		authTarget := target.ID
		if target.Kind == "dm" {
			authTarget = actor
		}
		_, e := notify.EnqueueTx(ctx, tx, notify.Event{UserID: recipient, Key: "message:" + messageID.String(), Type: "general", Category: "messages", Title: "New Connect message", Message: "You have a new message. Open Connect to read it.", ActionURL: "/connect", ActionLabel: "Open Connect", EntityType: &entityType, EntityID: &messageID, TargetKind: target.Kind, TargetID: authTarget})
		if e != nil {
			return nil, false, e
		}
	}
	data, err := jsonRow(ctx, tx, messageJSON(target.Kind), t, messageID)
	if err != nil {
		return nil, false, err
	}
	return data, true, tx.Commit(ctx)
}
func (s *Service) List(ctx context.Context, actor uuid.UUID, target Target) (json.RawMessage, error) {
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err = authorize(ctx, tx, t, actor, target); err != nil {
		return nil, err
	}
	table, where := "messages", `((m.sender_id=$2 AND m.receiver_id=$3)OR(m.sender_id=$3 AND m.receiver_id=$2))`
	if target.Kind == "group" {
		table, where = "group_messages", `m.group_id=$3`
	}
	return jsonRow(ctx, tx, `SELECT COALESCE(jsonb_agg(z.data ORDER BY z.created_at,z.id),'[]') FROM (SELECT m.id,m.created_at,(to_jsonb(m)-'tenant_id')||jsonb_build_object('attachments',`+attachmentsJSON+`,'full_name',u.full_name,'avatar_url',u.avatar_url) AS data FROM `+table+` m JOIN users u ON u.tenant_id=m.tenant_id AND u.id=m.sender_id WHERE m.tenant_id=$1 AND `+where+` AND $2::uuid IS NOT NULL ORDER BY m.created_at DESC,m.id DESC LIMIT 200) z`, t, actor, target.ID)
}
