package connectmedia

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Beginner interface {
	Begin(context.Context) (pgx.Tx, error)
}
type Service struct {
	Pool Beginner
	Root string
}
type Target struct {
	Kind string    `json:"kind"`
	ID   uuid.UUID `json:"id"`
}
type Asset struct {
	ID       uuid.UUID `json:"id"`
	Kind     string    `json:"kind"`
	Mime     string    `json:"mime"`
	Bytes    int64     `json:"bytes"`
	Width    *int      `json:"width"`
	Height   *int      `json:"height"`
	Duration *float64  `json:"duration_seconds"`
}

func (s *Service) begin(ctx context.Context, actor uuid.UUID) (pgx.Tx, uuid.UUID, error) {
	t, ok := tenant.From(ctx)
	if !ok || !t.IsActive || actor == uuid.Nil {
		return nil, uuid.Nil, ErrForbidden
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, t.ID, err
	}
	if _, err = tx.Exec(ctx, `SELECT set_config('app.tenant_id',$1,true)`, t.ID.String()); err != nil {
		tx.Rollback(ctx)
		return nil, t.ID, err
	}
	var active bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id=$1 AND id=$2 AND is_active AND is_approved AND deleted_at IS NULL)`, t.ID, actor).Scan(&active)
	if err != nil || !active {
		tx.Rollback(ctx)
		if err == nil {
			err = ErrForbidden
		}
		return nil, t.ID, err
	}
	return tx, t.ID, nil
}
func authorize(ctx context.Context, tx pgx.Tx, t, actor uuid.UUID, target Target) error {
	var yes bool
	if target.ID == uuid.Nil {
		return ErrInvalid
	}
	switch target.Kind {
	case "dm":
		err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM connections c JOIN users u ON u.tenant_id=c.tenant_id AND u.id=$3 WHERE c.tenant_id=$1 AND c.status='accepted' AND u.is_active AND u.is_approved AND u.deleted_at IS NULL AND ((c.requester_id=$2 AND c.receiver_id=$3)OR(c.requester_id=$3 AND c.receiver_id=$2)))`, t, actor, target.ID).Scan(&yes)
		if err != nil {
			return err
		}
	case "group":
		err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM group_members WHERE tenant_id=$1 AND group_id=$3 AND user_id=$2)`, t, actor, target.ID).Scan(&yes)
		if err != nil {
			return err
		}
	default:
		return ErrInvalid
	}
	if !yes {
		return ErrForbidden
	}
	return nil
}
func (s *Service) Intent(ctx context.Context, actor uuid.UUID, target Target) (uuid.UUID, error) {
	if !VoiceAvailable() {
		return uuid.Nil, ErrUnavailable
	}
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)
	if err = authorize(ctx, tx, t, actor, target); err != nil {
		return uuid.Nil, err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, t.String()+":connect:"+actor.String()); err != nil {
		return uuid.Nil, err
	}
	var count int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM connect_recording_intents WHERE tenant_id=$1 AND owner_id=$2 AND expires_at>now()`, t, actor).Scan(&count); err != nil {
		return uuid.Nil, err
	}
	if count >= 30 {
		return uuid.Nil, ErrQuota
	}
	var id uuid.UUID
	err = tx.QueryRow(ctx, `INSERT INTO connect_recording_intents(tenant_id,owner_id,target_kind,target_id)VALUES($1,$2,$3,$4) RETURNING id`, t, actor, target.Kind, target.ID).Scan(&id)
	if err != nil {
		return uuid.Nil, err
	}
	return id, tx.Commit(ctx)
}

const assetColumns = `id,kind,mime,bytes,width,height,duration_seconds`

func scanAsset(row pgx.Row) (Asset, error) {
	var a Asset
	err := row.Scan(&a.ID, &a.Kind, &a.Mime, &a.Bytes, &a.Width, &a.Height, &a.Duration)
	return a, err
}

// Upload reserves quota in the DB before any expensive decoding. A stable nonce
// makes transport retries reuse a completed upload, not create duplicates.
func (s *Service) Upload(ctx context.Context, actor uuid.UUID, target Target, kind string, nonce, intent uuid.UUID, input []byte) (Asset, error) {
	var empty Asset
	if nonce == uuid.Nil || (kind != "image" && kind != "voice") || len(input) == 0 || len(input) > MaxInput {
		return empty, ErrInvalid
	}
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return empty, err
	}
	defer tx.Rollback(ctx)
	if err = authorize(ctx, tx, t, actor, target); err != nil {
		return empty, err
	}
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, t.String()+":connect:"+actor.String()); err != nil {
		return empty, err
	}
	var existing, state, oldKind string
	var oldTarget uuid.UUID
	err = tx.QueryRow(ctx, `SELECT id::text,state,target_kind,target_id FROM connect_media WHERE tenant_id=$1 AND owner_id=$2 AND upload_nonce=$3`, t, actor, nonce).Scan(&existing, &state, &oldKind, &oldTarget)
	if err == nil {
		if state != "ready" || oldKind != target.Kind || oldTarget != target.ID {
			return empty, ErrConflict
		}
		return scanAsset(tx.QueryRow(ctx, `SELECT `+assetColumns+` FROM connect_media WHERE tenant_id=$1 AND id=$2 AND kind=$3`, t, existing, kind))
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return empty, err
	}
	var count int
	var bytes int64
	err = tx.QueryRow(ctx, `SELECT count(*),COALESCE(sum(input_bytes),0) FROM connect_media_usage WHERE tenant_id=$1 AND owner_id=$2 AND created_at>now()-interval '24 hours'`, t, actor).Scan(&count, &bytes)
	if err != nil {
		return empty, err
	}
	if count >= 100 || bytes+int64(len(input)) > 100<<20 {
		return empty, ErrQuota
	}
	if kind == "voice" {
		tag, e := tx.Exec(ctx, `UPDATE connect_recording_intents SET used=true WHERE tenant_id=$1 AND id=$2 AND owner_id=$3 AND target_kind=$4 AND target_id=$5 AND NOT used AND expires_at>now()`, t, intent, actor, target.Kind, target.ID)
		if e != nil {
			return empty, e
		}
		if tag.RowsAffected() != 1 {
			return empty, ErrInvalid
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO connect_media_usage(tenant_id,owner_id,input_bytes)VALUES($1,$2,$3)`, t, actor, len(input)); err != nil {
		return empty, err
	}
	id := uuid.New()
	path := id.String() + ".jpg"
	mime := "image/jpeg"
	if kind == "voice" {
		path = id.String() + ".m4a"
		mime = "audio/mp4"
	}
	var intentArg any
	if kind == "voice" {
		intentArg = intent
	}
	_, err = tx.Exec(ctx, `INSERT INTO connect_media(id,tenant_id,owner_id,target_kind,target_id,kind,state,upload_nonce,recording_intent,path,mime,input_bytes)VALUES($1,$2,$3,$4,$5,$6,'processing',$7,$8,$9,$10,$11)`, id, t, actor, target.Kind, target.ID, kind, nonce, intentArg, path, mime, len(input))
	if err != nil {
		return empty, err
	}
	if err = tx.Commit(ctx); err != nil {
		return empty, err
	}
	// Reservation is now durable. Compensate on failure; crash leftovers are
	// removed by the maintenance command, including files in processing state.
	completed := false
	defer func() {
		if !completed {
			cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
			defer cancel()
			_ = s.remove(cleanup, actor, id, true)
		}
	}()
	out, err := Process(ctx, kind, input)
	if err != nil {
		return empty, err
	}
	root, err := filepath.Abs(filepath.Join(s.Root, ".connect-private"))
	if err != nil {
		return empty, err
	}
	if err = os.MkdirAll(root, 0700); err != nil {
		return empty, err
	}
	tmp, err := os.CreateTemp(root, ".processing-")
	if err != nil {
		return empty, err
	}
	temp := tmp.Name()
	defer os.Remove(temp)
	if _, err = tmp.Write(out.Data); err != nil {
		tmp.Close()
		return empty, err
	}
	if err = tmp.Close(); err != nil {
		return empty, err
	}
	if err = os.Rename(temp, filepath.Join(root, path)); err != nil {
		return empty, err
	}
	finish, t, err := s.begin(ctx, actor)
	if err != nil {
		return empty, err
	}
	defer finish.Rollback(ctx)
	var width, height, duration any
	if out.Width > 0 {
		width = out.Width
		height = out.Height
	}
	if out.Duration > 0 {
		duration = out.Duration
	}
	a, err := scanAsset(finish.QueryRow(ctx, `UPDATE connect_media SET state='ready',bytes=$3,width=$4,height=$5,duration_seconds=$6 WHERE tenant_id=$1 AND id=$2 RETURNING `+assetColumns, t, id, len(out.Data), width, height, duration))
	if err != nil {
		return empty, err
	}
	if err = finish.Commit(ctx); err != nil {
		return empty, err
	}
	completed = true
	return a, nil
}
func (s *Service) remove(ctx context.Context, actor, id uuid.UUID, processing bool) error {
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var path string
	var intent *uuid.UUID
	err = tx.QueryRow(ctx, `DELETE FROM connect_media WHERE tenant_id=$1 AND id=$2 AND owner_id=$3 AND message_id IS NULL AND group_message_id IS NULL AND ($4 OR state='ready') RETURNING path,recording_intent`, t, id, actor, processing).Scan(&path, &intent)
	if err != nil {
		return ErrConflict
	}
	if intent != nil {
		if _, err = tx.Exec(ctx, `UPDATE connect_recording_intents SET used=false WHERE tenant_id=$1 AND id=$2`, t, *intent); err != nil {
			return err
		}
	}
	if !SafeFilename(path) {
		return ErrInvalid
	}
	// Commit deletion first: a crash/rollback must never leave a ready row
	// pointing at a file we removed. A leftover file is safely swept as orphaned.
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	if err = os.Remove(filepath.Join(s.Root, ".connect-private", path)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
func (s *Service) Remove(ctx context.Context, actor, id uuid.UUID) error {
	return s.remove(ctx, actor, id, false)
}
func SafeFilename(name string) bool {
	ext := filepath.Ext(name)
	_, err := uuid.Parse(strings.TrimSuffix(name, ext))
	return err == nil && (ext == ".jpg" || ext == ".m4a") && filepath.Base(name) == name
}
func (s *Service) Access(ctx context.Context, actor, id uuid.UUID) (Asset, string, error) {
	tx, t, err := s.begin(ctx, actor)
	if err != nil {
		return Asset{}, "", err
	}
	defer tx.Rollback(ctx)
	var target Target
	var path string
	var dm, group *uuid.UUID
	err = tx.QueryRow(ctx, `SELECT target_kind,target_id,path,message_id,group_message_id FROM connect_media WHERE tenant_id=$1 AND id=$2 AND state='ready'`, t, id).Scan(&target.Kind, &target.ID, &path, &dm, &group)
	if err != nil || dm == nil && group == nil {
		return Asset{}, "", ErrForbidden
	}
	if target.Kind == "dm" {
		var sender, receiver uuid.UUID
		if err = tx.QueryRow(ctx, `SELECT sender_id,receiver_id FROM messages WHERE tenant_id=$1 AND id=$2`, t, *dm).Scan(&sender, &receiver); err != nil {
			return Asset{}, "", ErrForbidden
		}
		if actor != sender && actor != receiver {
			return Asset{}, "", ErrForbidden
		}
		target.ID = sender
		if actor == sender {
			target.ID = receiver
		}
	}
	if err = authorize(ctx, tx, t, actor, target); err != nil {
		return Asset{}, "", err
	}
	if !SafeFilename(path) {
		return Asset{}, "", ErrInvalid
	}
	a, err := scanAsset(tx.QueryRow(ctx, `SELECT `+assetColumns+` FROM connect_media WHERE tenant_id=$1 AND id=$2`, t, id))
	return a, filepath.Join(s.Root, ".connect-private", path), err
}
func jsonRow(ctx context.Context, tx pgx.Tx, q string, args ...any) (json.RawMessage, error) {
	var b []byte
	err := tx.QueryRow(ctx, q, args...).Scan(&b)
	return b, err
}
