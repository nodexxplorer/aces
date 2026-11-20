package connectmedia

import (
	"context"
	"errors"
	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
)

func TestConnectMediaPostgres(t *testing.T) {
	src := os.Getenv("DB_SOURCE")
	if src == "" {
		t.Skip("DB_SOURCE not set; skipping Connect database integration tests")
	}
	ctx := context.Background()
	setup, err := pgx.Connect(ctx, src)
	if err != nil {
		t.Fatal(err)
	}
	suffix := strings.ReplaceAll(uuid.NewString(), "-", "")
	dbname := "aces_connect_" + suffix
	role := "aces_connect_rt_" + suffix
	must := func(conn *pgx.Conn, sql string, args ...any) {
		t.Helper()
		if _, e := conn.Exec(ctx, sql, args...); e != nil {
			t.Fatalf("SQL %s: %v", sql, e)
		}
	}
	must(setup, "CREATE DATABASE "+pgx.Identifier{dbname}.Sanitize())
	t.Cleanup(func() {
		_, _ = setup.Exec(context.Background(), "DROP DATABASE "+pgx.Identifier{dbname}.Sanitize()+" WITH (FORCE)")
		_, _ = setup.Exec(context.Background(), "DROP ROLE IF EXISTS "+pgx.Identifier{role}.Sanitize())
		setup.Close(context.Background())
	})
	u, err := url.Parse(src)
	if err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + dbname
	owner, err := pgx.Connect(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { owner.Close(context.Background()) })
	dir := os.Getenv("ACES_MIGRATIONS_DIR")
	if dir == "" {
		dir = filepath.Join("..", "db", "migrations")
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil || len(files) == 0 {
		t.Fatalf("find migrations: %v", err)
	}
	sort.Strings(files)
	for _, file := range files {
		b, e := os.ReadFile(file)
		if e != nil {
			t.Fatal(e)
		}
		must(owner, string(b))
	}
	ident := pgx.Identifier{role}.Sanitize()
	for _, sql := range []string{"CREATE ROLE " + ident + " NOLOGIN", "GRANT USAGE ON SCHEMA public TO " + ident, "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO " + ident, "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO " + ident} {
		must(owner, sql)
	}
	mgr, err := tenant.NewManager(ctx, u.String(), tenant.Options{DefaultSlug: "uniuyo-ce", RuntimeRole: role})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(mgr.Close)
	dept := tenant.Tenant{ID: uuid.New(), Slug: "invite-dept", Name: "Invitation Department", URLCode: "iv", IsActive: true}
	other := tenant.Tenant{ID: uuid.New(), Slug: "other-invite", Name: "Other", IsActive: true}
	must(owner, `INSERT INTO tenants(id,slug,name,url_code) VALUES($1,$2,$3,$4)`, dept.ID, dept.Slug, dept.Name, dept.URLCode)
	must(owner, `INSERT INTO tenants(id,slug,name) VALUES($1,$2,$3)`, other.ID, other.Slug, other.Name)
	bound := tenant.With(ctx, dept)
	otherCtx := tenant.With(ctx, other)
	svc := Service{Pool: mgr.DB(), Root: t.TempDir()}
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	for _, id := range []uuid.UUID{a, b, c} {
		must(owner, `INSERT INTO users(tenant_id,id,email,password_hash,first_name,role,is_approved)VALUES($1,$2,$3,'hash',$3,'student',true)`, dept.ID, id, id.String()+"@example.edu")
	}
	must(owner, `INSERT INTO connections(tenant_id,requester_id,receiver_id,status)VALUES($1,$2,$3,'accepted')`, dept.ID, a, b)
	group := uuid.New()
	must(owner, `INSERT INTO groups(tenant_id,id,name,created_by)VALUES($1,$2,'Study group',$3)`, dept.ID, group, a)
	must(owner, `INSERT INTO group_members(tenant_id,group_id,user_id,role)VALUES($1,$2,$3,'admin'),($1,$2,$4,'member')`, dept.ID, group, a, b)
	dm := Target{Kind: "dm", ID: b}
	g := Target{Kind: "group", ID: group}
	input := picture(t, 48, 32)
	if _, e := svc.Upload(bound, c, dm, "image", uuid.New(), uuid.Nil, input); !errors.Is(e, ErrForbidden) {
		t.Fatal("unconnected uploader", e)
	}
	nonce := uuid.New()
	asset, e := svc.Upload(bound, a, dm, "image", nonce, uuid.Nil, input)
	if e != nil {
		t.Fatal("upload", e)
	}
	if _, _, e = svc.Access(bound, a, asset.ID); !errors.Is(e, ErrForbidden) {
		t.Fatal("unattached media readable", e)
	}
	retry, e := svc.Upload(bound, a, dm, "image", nonce, uuid.Nil, input)
	if e != nil || retry.ID != asset.ID {
		t.Fatal("upload retry duplicated", e)
	}
	if _, _, e = svc.Send(bound, a, g, SendRequest{Content: "cross target", Attachments: []uuid.UUID{asset.ID}, Nonce: uuid.New()}); !errors.Is(e, ErrForbidden) {
		t.Fatal("cross-conversation attach", e)
	}
	req := SendRequest{Content: "Lecture photo", Attachments: []uuid.UUID{asset.ID}, Nonce: uuid.New()}
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	created := make(chan bool, 2)
	for n := 0; n < 2; n++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, new, e := svc.Send(bound, a, dm, req); errs <- e; created <- new }()
	}
	wg.Wait()
	close(errs)
	close(created)
	for err := range errs {
		if err != nil {
			t.Fatal("concurrent send", err)
		}
	}
	count := 0
	for new := range created {
		if new {
			count++
		}
	}
	if count != 1 {
		t.Fatal("duplicate message", count)
	}
	if _, path, e := svc.Access(bound, b, asset.ID); e != nil {
		t.Fatal("recipient access", e)
	} else if _, e = os.Stat(path); e != nil {
		t.Fatal("file missing", e)
	}
	for _, ctx2 := range []context.Context{otherCtx, bound} {
		actor := a
		if ctx2 == bound {
			actor = c
		}
		if _, _, e = svc.Access(ctx2, actor, asset.ID); !errors.Is(e, ErrForbidden) {
			t.Fatal("private media exposed", e)
		}
	}
	if e = svc.Remove(bound, a, asset.ID); !errors.Is(e, ErrConflict) {
		t.Fatal("attached media deleted", e)
	}
	list, e := svc.List(bound, b, Target{Kind: "dm", ID: a})
	if e != nil || !strings.Contains(string(list), asset.ID.String()) || strings.Contains(string(list), ".connect-private") {
		t.Fatal("history attachment metadata", string(list), e)
	}
	changed := req
	changed.Content = "Different body"
	if _, _, e = svc.Send(bound, a, dm, changed); !errors.Is(e, ErrConflict) {
		t.Fatal("retry content silently changed", e)
	}
	photo, e := svc.Upload(bound, a, g, "image", uuid.New(), uuid.Nil, input)
	if e != nil {
		t.Fatal(e)
	}
	if _, _, e = svc.Send(bound, a, g, SendRequest{Attachments: []uuid.UUID{photo.ID}, Nonce: uuid.New()}); e != nil {
		t.Fatal("group send", e)
	}
	if _, _, e = svc.Access(bound, b, photo.ID); e != nil {
		t.Fatal("member access", e)
	}
	must(owner, `DELETE FROM group_members WHERE tenant_id=$1 AND group_id=$2 AND user_id=$3`, dept.ID, group, b)
	if _, _, e = svc.Access(bound, b, photo.ID); !errors.Is(e, ErrForbidden) {
		t.Fatal("former member retained access", e)
	}
	if _, e = svc.List(bound, b, g); !errors.Is(e, ErrForbidden) {
		t.Fatal("former member history access", e)
	}
	discarded, e := svc.Upload(bound, a, dm, "image", uuid.New(), uuid.Nil, input)
	if e != nil {
		t.Fatal(e)
	}
	if e = svc.Remove(bound, a, discarded.ID); e != nil {
		t.Fatal("discard", e)
	}
	var usage int
	if e = owner.QueryRow(ctx, `SELECT count(*) FROM connect_media_usage WHERE tenant_id=$1 AND owner_id=$2`, dept.ID, a).Scan(&usage); e != nil || usage != 3 {
		t.Fatal("quota was released by discard or upload retry billed twice", usage, e)
	}
	if _, e = svc.Upload(bound, a, dm, "voice", uuid.New(), uuid.Nil, input); !errors.Is(e, ErrInvalid) {
		t.Fatal("voice without recording intent", e)
	}
	if VoiceAvailable() {
		intent, e := svc.Intent(bound, a, dm)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = svc.Upload(bound, a, dm, "voice", uuid.New(), intent, []byte("not audio")); !errors.Is(e, ErrInvalid) {
			t.Fatal("invalid recording accepted", e)
		}
	}
	if VoiceAvailable() {
		recording := filepath.Join(t.TempDir(), "recording.m4a")
		if out, err := exec.Command(executable("CONNECT_FFMPEG_PATH", "ffmpeg"), "-v", "error", "-f", "lavfi", "-i", "sine=duration=1", "-c:a", "aac", "-y", recording).CombinedOutput(); err != nil {
			t.Fatal(err, string(out))
		}
		data, err := os.ReadFile(recording)
		if err != nil {
			t.Fatal(err)
		}
		intent, err := svc.Intent(bound, a, dm)
		if err != nil {
			t.Fatal(err)
		}
		voice, err := svc.Upload(bound, a, dm, "voice", uuid.New(), intent, data)
		if err != nil {
			t.Fatal("recorded voice upload", err)
		}
		if _, err = svc.Upload(bound, a, dm, "voice", uuid.New(), intent, data); !errors.Is(err, ErrInvalid) {
			t.Fatal("recording intent replay", err)
		}
		pending, err := svc.Upload(bound, a, dm, "image", uuid.New(), uuid.Nil, input)
		if err != nil {
			t.Fatal(err)
		}
		if _, _, err = svc.Send(bound, a, dm, SendRequest{Attachments: []uuid.UUID{voice.ID, pending.ID}, Nonce: uuid.New()}); !errors.Is(err, ErrInvalid) {
			t.Fatal("mixed voice and image message", err)
		}
		if _, _, err = svc.Send(bound, a, dm, SendRequest{Attachments: []uuid.UUID{voice.ID}, Nonce: uuid.New()}); err != nil {
			t.Fatal("recorded voice send", err)
		}
		if _, _, err = svc.Access(bound, b, voice.ID); err != nil {
			t.Fatal("received voice access", err)
		}
	}
	// Transport/decode failure leaves no ready attachment but does consume quota.
	if _, e = svc.Upload(bound, a, dm, "image", uuid.New(), uuid.Nil, []byte("video renamed photo.jpg")); !errors.Is(e, ErrInvalid) {
		t.Fatal("invalid media accepted", e)
	}
	var processing int
	_ = owner.QueryRow(ctx, `SELECT count(*) FROM connect_media WHERE tenant_id=$1 AND state='processing'`, dept.ID).Scan(&processing)
	if processing != 0 {
		t.Fatal("failed processing leaked reservations", processing)
	}
	must(owner, `INSERT INTO connect_media_usage(tenant_id,owner_id,input_bytes) SELECT $1,$2,1 FROM generate_series(1,100)`, dept.ID, a)
	if _, err = svc.Upload(bound, a, dm, "image", uuid.New(), uuid.Nil, input); !errors.Is(err, ErrQuota) {
		t.Fatal("daily upload quota", err)
	}
	var visible int
	if err = mgr.DB().QueryRow(otherCtx, `SELECT count(*) FROM connect_media`).Scan(&visible); err != nil || visible != 0 {
		t.Fatal("tenant RLS exposed attachments", visible, err)
	}
	// Revoke the connection: no further downloads/sends are authorized.
	must(owner, `UPDATE connections SET status='rejected' WHERE tenant_id=$1 AND requester_id=$2 AND receiver_id=$3`, dept.ID, a, b)
	if _, _, e = svc.Access(bound, b, asset.ID); !errors.Is(e, ErrForbidden) {
		t.Fatal("revoked connection media", e)
	}
	// Exercise rollback/reapply of this migration against the real baseline.
	down, e := os.ReadFile(filepath.Join(dir, "000019_connect_media.down.sql"))
	if e != nil {
		t.Fatal(e)
	}
	must(owner, string(down))
	up, e := os.ReadFile(filepath.Join(dir, "000019_connect_media.up.sql"))
	if e != nil {
		t.Fatal(e)
	}
	must(owner, string(up))
}
