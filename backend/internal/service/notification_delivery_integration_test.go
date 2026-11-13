package service

import (
	"context"
	"errors"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/notify"
	pushpkg "github.com/aces/backend/internal/push"
	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
)

type deliveryEmail struct {
	mu         sync.Mutex
	calls      int
	fail       bool
	alwaysFail bool
	mock       bool
}

func (m *deliveryEmail) Mock() bool { return m.mock }
func (m *deliveryEmail) SendEmail(to []string, subject, body string, html bool) error {
	return m.SendEmailFrom("", to, subject, body, html)
}
func (m *deliveryEmail) SendEmailFrom(_ string, to []string, subject, body string, html bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls++
	if m.fail || m.alwaysFail {
		m.fail = false
		return errors.New("provider down")
	}
	return nil
}

type deliveryPush struct {
	mu           sync.Mutex
	calls        int
	unregistered bool
}

func (m *deliveryPush) SendPush(token, title, body string, data map[string]interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls++
	if m.unregistered {
		return pushpkg.ErrUnregistered
	}
	return nil
}
func TestNotificationDeliveryPostgres(t *testing.T) {
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
	dbname := "aces_notifications_" + suffix
	role := "aces_notifications_rt_" + suffix
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
	q := db.New(mgr.DB())
	mail := &deliveryEmail{fail: true}
	push := &deliveryPush{}
	svc := NewNotificationServiceFull(q, nil, mail, push, "https://portal.example", nil, "https://api.example")
	user := uuid.New()
	must(owner, `INSERT INTO users(tenant_id,id,email,password_hash,first_name,role,is_approved)VALUES($1,$2,'notify@example.edu','hash','Student','student',true)`, dept.ID, user)
	yes, no := true, false
	p, e := q.UpsertNotificationPreferences(bound, db.UpsertNotificationPreferencesParams{UserID: user, EmailSystem: &yes, PushSystem: &yes})
	if e != nil {
		t.Fatal(e)
	}
	for _, address := range []string{"ExpoPushToken[deviceone1234]", "ExpoPushToken[devicetwo1234]"} {
		must(owner, `INSERT INTO notification_devices(tenant_id,user_id,platform,address)VALUES($1,$2,'expo',$3)`, dept.ID, user, address)
	}
	event := notify.Event{UserID: user, Key: "dedup:test", Type: "payment", Category: "system", Title: "Payment accepted", Message: "A payment update", ActionURL: "/payments"}
	n, e := notify.Enqueue(bound, mgr.DB(), event)
	if e != nil {
		t.Fatal(e)
	}
	retry, e := notify.Enqueue(bound, mgr.DB(), event)
	if e != nil || retry.ID != n.ID {
		t.Fatal("duplicate event", e)
	}
	stored, e := q.GetNotificationFull(bound, n.ID)
	if e != nil || stored.ActionUrl == nil || *stored.ActionUrl != "/payments" {
		t.Fatal("persisted action URL", e, stored)
	}
	var count int
	if e = mgr.DB().QueryRow(bound, `SELECT count(*) FROM notification_deliveries`).Scan(&count); e != nil || count != 4 {
		t.Fatal("jobs", count, e)
	}
	if e = svc.ProcessPending(bound, 20); e != nil {
		t.Fatal(e)
	}
	if mail.calls != 1 || push.calls != 2 {
		t.Fatal("first processing", mail.calls, push.calls)
	}
	must(owner, `UPDATE notification_deliveries SET next_attempt_at=now() WHERE tenant_id=$1 AND status='queued'`, dept.ID)
	if e = svc.ProcessPending(bound, 20); e != nil {
		t.Fatal(e)
	}
	if mail.calls != 2 || push.calls != 2 {
		t.Fatal("retry duplicated accepted channel", mail.calls, push.calls)
	}
	if e = mgr.DB().QueryRow(bound, `SELECT count(*) FROM notification_deliveries WHERE status='accepted'`).Scan(&count); e != nil || count != 4 {
		t.Fatal("acceptance", count, e)
	}
	// New deliveries must respect switches changed after enqueue.
	event.Key = "toggle:test"
	if _, e = notify.Enqueue(bound, mgr.DB(), event); e != nil {
		t.Fatal(e)
	}
	if _, e = q.UpsertNotificationPreferences(bound, db.UpsertNotificationPreferencesParams{UserID: user, EmailEnabled: &no, PushEnabled: &no, InAppEnabled: &no}); e != nil {
		t.Fatal(e)
	}
	if e = svc.ProcessPending(bound, 20); e != nil {
		t.Fatal(e)
	}
	if mail.calls != 2 || push.calls != 2 {
		t.Fatal("disabled channels sent")
	}
	// An unrelated partial update must not reset the other switches.
	p, e = q.UpsertNotificationPreferences(bound, db.UpsertNotificationPreferencesParams{UserID: user, EmailAuth: &yes})
	if e != nil || p.EmailEnabled || p.InAppEnabled || p.PushEnabled {
		t.Fatal("partial update reset channels", e)
	}
	local := time.Now().In(time.FixedZone("Lagos", 3600))
	start, end := local.Add(-time.Hour).Format("15:04"), local.Add(time.Hour).Format("15:04")
	p, e = q.UpsertNotificationPreferences(bound, db.UpsertNotificationPreferencesParams{UserID: user, EmailEnabled: &yes, PushEnabled: &yes, InAppEnabled: &yes, QuietHoursStart: &start, QuietHoursEnd: &end, QuietHoursSet: true})
	if e != nil {
		t.Fatal(e)
	}
	event.Key = "quiet:test"
	if _, e = notify.Enqueue(bound, mgr.DB(), event); e != nil {
		t.Fatal(e)
	}
	if e = svc.ProcessPending(bound, 20); e != nil {
		t.Fatal(e)
	}
	if mail.calls != 2 || push.calls != 2 {
		t.Fatal("quiet hours ignored")
	}
	p, e = q.UpsertNotificationPreferences(bound, db.UpsertNotificationPreferencesParams{UserID: user, QuietHoursSet: true})
	if e != nil || p.QuietHoursStart != nil || p.QuietHoursEnd != nil {
		t.Fatal("cannot clear quiet hours", e)
	}
	// Tenant RLS and transactions protect queue/history as well as domain rows.
	if e = mgr.DB().QueryRow(otherCtx, `SELECT count(*) FROM notification_events`).Scan(&count); e != nil || count != 0 {
		t.Fatal("cross-tenant outbox exposed", count, e)
	}
	tx, e := mgr.DB().Begin(bound)
	if e != nil {
		t.Fatal(e)
	}
	event.Key = "rolled-back"
	if _, e = notify.EnqueueTx(bound, tx, event); e != nil {
		t.Fatal(e)
	}
	_ = tx.Rollback(bound)
	if e = mgr.DB().QueryRow(bound, `SELECT count(*) FROM notification_events WHERE event_key='rolled-back'`).Scan(&count); e != nil || count != 0 {
		t.Fatal("rollback leaked notification", count, e)
	}
	// Recover a worker that died while holding a delivery lease.
	must(owner, `UPDATE notification_deliveries SET status='processing',lease_until=now()-interval '1 minute' WHERE tenant_id=$1 AND status='queued'`, dept.ID)
	if e = svc.ProcessPending(bound, 20); e != nil {
		t.Fatal(e)
	}
	if mail.calls != 3 || push.calls != 4 {
		t.Fatal("expired lease not recovered", mail.calls, push.calls)
	}
	mail.mock = true
	event.Key = "simulation:test"
	if _, e = notify.Enqueue(bound, mgr.DB(), event); e != nil {
		t.Fatal(e)
	}
	if e = svc.ProcessPending(bound, 20); e != nil {
		t.Fatal(e)
	}
	if e = mgr.DB().QueryRow(bound, `SELECT count(*) FROM notification_deliveries WHERE channel='email' AND status='simulated'`).Scan(&count); e != nil || count != 1 {
		t.Fatal("mock reported delivered", count, e)
	}
	mail.mock = false
	mail.alwaysFail = true
	push.unregistered = true
	event.Key = "permanent-failure"
	if _, e = notify.Enqueue(bound, mgr.DB(), event); e != nil {
		t.Fatal(e)
	}
	for i := 0; i < 6; i++ {
		must(owner, `UPDATE notification_deliveries SET next_attempt_at=now() WHERE tenant_id=$1 AND status='queued'`, dept.ID)
		if e = svc.ProcessPending(bound, 20); e != nil {
			t.Fatal(e)
		}
	}
	if e = mgr.DB().QueryRow(bound, `SELECT count(*) FROM notification_deliveries WHERE channel='email' AND status='failed'`).Scan(&count); e != nil || count != 1 {
		t.Fatal("retry exhaustion not recorded", count, e)
	}
	if e = mgr.DB().QueryRow(bound, `SELECT count(*) FROM notification_devices WHERE active`).Scan(&count); e != nil || count != 0 {
		t.Fatal("unregistered devices retained", count, e)
	}
	calls := mail.calls
	event.Key = "revoked-conversation"
	event.TargetKind = "group"
	event.TargetID = uuid.New()
	if _, e = notify.Enqueue(bound, mgr.DB(), event); e != nil {
		t.Fatal(e)
	}
	if e = svc.ProcessPending(bound, 20); e != nil {
		t.Fatal(e)
	}
	if mail.calls != calls {
		t.Fatal("revoked conversation emitted external mail")
	}
}
