package invitation

import (
	"context"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"

	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type testMail struct {
	mu     sync.Mutex
	bodies map[string][]string
	fail   bool
}

func (m *testMail) SendEmail(to []string, subject, body string, html bool) error {
	return m.SendEmailFrom("", to, subject, body, html)
}
func (m *testMail) SendEmailFrom(_ string, to []string, _ string, body string, _ bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.fail {
		return errors.New("SMTP unavailable")
	}
	for _, e := range to {
		m.bodies[e] = append(m.bodies[e], body)
	}
	return nil
}
func (m *testMail) token(t *testing.T, email string) string {
	t.Helper()
	m.mu.Lock()
	defer m.mu.Unlock()
	messages := m.bodies[email]
	if len(messages) == 0 {
		t.Fatal("no invitation email for", email)
	}
	body := messages[len(messages)-1]
	start := strings.Index(body, "/accept-invitation#")
	if start < 0 {
		t.Fatal("no acceptance link")
	}
	fragment := strings.Fields(body[start+len("/accept-invitation#"):])[0]
	v, err := url.ParseQuery(fragment)
	if err != nil {
		t.Fatal(err)
	}
	return v.Get("token")
}
func (m *testMail) count(email string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.bodies[email])
}
func TestInvitationsPostgres(t *testing.T) {
	src := os.Getenv("DB_SOURCE")
	if src == "" {
		t.Skip("DB_SOURCE not set; skipping invitation database integration tests")
	}
	ctx := context.Background()
	setup, err := pgx.Connect(ctx, src)
	if err != nil {
		t.Fatal(err)
	}
	suffix := strings.ReplaceAll(uuid.NewString(), "-", "")
	dbname := "aces_invites_" + suffix
	role := "aces_invites_rt_" + suffix
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
	sender := &testMail{bodies: map[string][]string{}}
	svc := Service{Pool: mgr.DB(), Sender: sender, FrontendURL: "https://app.example.edu"}
	accept := func(token string) AcceptRequest {
		return AcceptRequest{Token: token, FirstName: "Test", LastName: "Person", Password: "a sufficiently long password"}
	}
	bootstrap, err := svc.Bootstrap(bound, Request{Email: "first@example.edu", Name: "First HOD"})
	if err != nil {
		t.Fatal("bootstrap:", err)
	}
	token := sender.token(t, bootstrap.Email)
	if _, err = svc.Bootstrap(bound, Request{Email: "second@example.edu", Name: "Second"}); !errors.Is(err, ErrConflict) {
		t.Fatal("duplicate bootstrap allowed", err)
	}
	if _, err = svc.Inspect(otherCtx, token); !errors.Is(err, ErrInvalid) {
		t.Fatal("cross-tenant preview allowed", err)
	}
	p, err := svc.Inspect(bound, token)
	if err != nil || p.AccountExists {
		t.Fatalf("preview: %+v %v", p, err)
	}
	var count int
	err = owner.QueryRow(ctx, `SELECT count(*) FROM users WHERE tenant_id=$1`, dept.ID).Scan(&count)
	if err != nil || count != 0 {
		t.Fatal("preview created access")
	}
	hod, err := svc.Accept(bound, nil, accept(token))
	if err != nil {
		t.Fatal("bootstrap accept:", err)
	}
	if _, err = svc.Accept(bound, nil, accept(token)); !errors.Is(err, ErrInvalid) {
		t.Fatal("token reused", err)
	}
	if _, err = svc.Bootstrap(bound, Request{Email: "later@example.edu", Name: "Later"}); !errors.Is(err, ErrConflict) {
		t.Fatal("bootstrap reopened", err)
	}
	adminInvite, err := svc.Create(bound, hod, Request{Email: "delegate@example.edu", Name: "Delegate", Role: "admin", Grants: map[string]bool{"can_manage_users": true}})
	if err != nil {
		t.Fatal(err)
	}
	admin, err := svc.Accept(bound, nil, accept(sender.token(t, adminInvite.Email)))
	if err != nil {
		t.Fatal("admin accept:", err)
	}
	pending, err := svc.Create(bound, admin, Request{Email: "another-admin@example.edu", Name: "Other Admin", Role: "admin", Grants: map[string]bool{"can_manage_finance": true}})
	if err != nil || pending.Status != "pending_approval" {
		t.Fatalf("pending: %+v %v", pending, err)
	}
	if sender.count(pending.Email) != 0 {
		t.Fatal("privileged access link sent before approval")
	}
	if sender.count("first@example.edu") < 2 {
		t.Fatal("HOD not notified")
	}
	for _, action := range []string{"approve", "resend"} {
		if _, err = svc.Act(bound, admin, pending.ID, action); !errors.Is(err, ErrForbidden) {
			t.Fatal("delegate bypassed approval", action, err)
		}
	}
	approved, err := svc.Act(bound, hod, pending.ID, "approve")
	if err != nil || approved.Status != "sent" {
		t.Fatal("approve:", err)
	}
	approvedToken := sender.token(t, pending.Email)
	if _, err = svc.Act(bound, hod, pending.ID, "resend"); !errors.Is(err, ErrRateLimit) {
		t.Fatal("unthrottled resend", err)
	}
	must(owner, `UPDATE access_invitations SET last_sent_at=now()-interval '2 minutes' WHERE id=$1`, pending.ID)
	if _, err = svc.Act(bound, admin, pending.ID, "resend"); err != nil {
		t.Fatal("requester resend:", err)
	}
	if _, err = svc.Inspect(bound, approvedToken); !errors.Is(err, ErrInvalid) {
		t.Fatal("old resend token valid", err)
	}
	otherAdmin, err := svc.Accept(bound, nil, accept(sender.token(t, pending.Email)))
	if err != nil {
		t.Fatal("approved admin accept:", err)
	}
	var finance, users bool
	if err = owner.QueryRow(ctx, `SELECT can_manage_finance,can_manage_users FROM admin_permissions WHERE user_id=$1`, otherAdmin).Scan(&finance, &users); err != nil || !finance || users {
		t.Fatal("grants differ from approved set", err)
	}
	existing, err := svc.Create(bound, hod, Request{Email: "delegate@example.edu", Name: "Delegate", Role: "lecturer"})
	if err != nil {
		t.Fatal(err)
	}
	existingToken := sender.token(t, existing.Email)
	if _, err = svc.Accept(bound, nil, AcceptRequest{Token: existingToken}); !errors.Is(err, ErrSignIn) {
		t.Fatal("existing account claimed without sign-in", err)
	}
	if _, err = svc.Accept(bound, &hod, AcceptRequest{Token: existingToken}); !errors.Is(err, ErrForbidden) {
		t.Fatal("wrong identity accepted", err)
	}
	if _, err = svc.Accept(bound, &admin, AcceptRequest{Token: existingToken}); err != nil {
		t.Fatal("matching existing account:", err)
	}
	lecturer, err := svc.Create(bound, admin, Request{Email: "lecturer@example.edu", Name: "Lecturer", Role: "lecturer"})
	if err != nil || lecturer.Status != "sent" {
		t.Fatal("lecturer send:", err)
	}
	lecturerToken := sender.token(t, lecturer.Email)
	must(owner, `UPDATE admin_permissions SET can_manage_users=false WHERE user_id=$1`, admin)
	if _, err = svc.Accept(bound, nil, accept(lecturerToken)); !errors.Is(err, ErrForbidden) {
		t.Fatal("accept ignored revoked authorizer permission", err)
	}
	if _, err = svc.Create(bound, otherAdmin, Request{Email: "no@example.edu", Name: "No", Role: "lecturer"}); !errors.Is(err, ErrForbidden) {
		t.Fatal("finance-only admin invited", err)
	}
	if _, err = svc.List(otherCtx, hod); !errors.Is(err, ErrForbidden) {
		t.Fatal("cross-tenant list allowed", err)
	}
	revoked, err := svc.Create(bound, hod, Request{Email: "revoked@example.edu", Name: "Revoked", Role: "lecturer"})
	if err != nil {
		t.Fatal(err)
	}
	revokedToken := sender.token(t, revoked.Email)
	if _, err = svc.Act(bound, hod, revoked.ID, "revoke"); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Accept(bound, nil, accept(revokedToken)); !errors.Is(err, ErrInvalid) {
		t.Fatal("accepted revoked invite", err)
	}
	expired, err := svc.Create(bound, hod, Request{Email: "expired@example.edu", Name: "Expired", Role: "lecturer"})
	if err != nil {
		t.Fatal(err)
	}
	expiredToken := sender.token(t, expired.Email)
	must(owner, `UPDATE access_invitations SET expires_at=now()-interval '1 second' WHERE id=$1`, expired.ID)
	if _, err = svc.Accept(bound, nil, accept(expiredToken)); !errors.Is(err, ErrInvalid) {
		t.Fatal("accepted expired invite", err)
	}

	replacementInvite, err := svc.Create(bound, hod, Request{Email: expired.Email, Name: "Replacement", Role: "lecturer"})
	if err != nil {
		t.Fatal("fresh invitation after expiry:", err)
	}
	if _, err = svc.Act(bound, hod, expired.ID, "resend"); !errors.Is(err, ErrConflict) {
		t.Fatal("resend ignored replacement invitation", err)
	}
	if _, err = svc.Act(bound, hod, replacementInvite.ID, "revoke"); err != nil {
		t.Fatal(err)
	}
	pendingHOD, err := svc.Create(bound, admin, Request{Email: "extra-hod@example.edu", Name: "Extra HOD", Role: "hod"})
	// The delegate's user-management grant was revoked above; restore it before
	// requesting an additional HOD so this path tests approval, not stale claims.
	if !errors.Is(err, ErrForbidden) {
		t.Fatal("revoked delegate requested HOD", pendingHOD, err)
	}
	must(owner, `UPDATE admin_permissions SET can_manage_users=true WHERE user_id=$1`, admin)
	pendingHOD, err = svc.Create(bound, admin, Request{Email: "extra-hod@example.edu", Name: "Extra HOD", Role: "hod"})
	if err != nil || pendingHOD.Status != "pending_approval" || sender.count(pendingHOD.Email) != 0 {
		t.Fatal("HOD invitation bypassed approval", err)
	}
	if _, err = svc.Act(bound, hod, pendingHOD.ID, "approve"); err != nil {
		t.Fatal(err)
	}
	extraHOD, err := svc.Accept(bound, nil, accept(sender.token(t, pendingHOD.Email)))
	if err != nil {
		t.Fatal("additional HOD acceptance:", err)
	}
	if _, err = svc.List(bound, hod); err != nil {
		t.Fatal("invitation removed original HOD", err)
	}
	if _, err = svc.List(bound, extraHOD); err != nil {
		t.Fatal("additional HOD lacks access", err)
	}
	rollbackInvite, err := svc.Create(bound, hod, Request{Email: "rollback@example.edu", Name: "Rollback", Role: "lecturer"})
	if err != nil {
		t.Fatal(err)
	}
	rollbackToken := sender.token(t, rollbackInvite.Email)
	must(owner, `CREATE FUNCTION fail_staff_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$; CREATE TRIGGER fail_staff_test BEFORE INSERT ON staff FOR EACH ROW EXECUTE FUNCTION fail_staff_test()`)
	if _, err = svc.Accept(bound, nil, accept(rollbackToken)); err == nil {
		t.Fatal("expected staff failure")
	}
	must(owner, `DROP TRIGGER fail_staff_test ON staff; DROP FUNCTION fail_staff_test()`)
	if err = owner.QueryRow(ctx, `SELECT count(*) FROM users WHERE tenant_id=$1 AND email=$2`, dept.ID, rollbackInvite.Email).Scan(&count); err != nil || count != 0 {
		t.Fatal("partial user persisted")
	}
	if _, err = svc.Accept(bound, nil, accept(rollbackToken)); err != nil {
		t.Fatal("rolled-back token lost:", err)
	}
	concurrent, err := svc.Create(bound, hod, Request{Email: "race@example.edu", Name: "Race", Role: "lecturer"})
	if err != nil {
		t.Fatal(err)
	}
	raceToken := sender.token(t, concurrent.Email)
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for range 2 {
		wg.Go(func() { _, e := svc.Accept(bound, nil, accept(raceToken)); results <- e })
	}
	wg.Wait()
	close(results)
	success := 0
	for e := range results {
		if e == nil {
			success++
		} else if !errors.Is(e, ErrInvalid) {
			t.Fatal(e)
		}
	}
	if success != 1 {
		t.Fatal("concurrent accept successes:", success)
	}
	sender.mu.Lock()
	sender.fail = true
	sender.mu.Unlock()
	failed, err := svc.Create(bound, hod, Request{Email: "smtp@example.edu", Name: "SMTP", Role: "lecturer"})
	if err != nil || !failed.DeliveryFailed {
		t.Fatal("SMTP failure not recorded", err)
	}
	var raw string
	if err = owner.QueryRow(ctx, `SELECT token_hash FROM access_invitations WHERE id=$1`, failed.ID).Scan(&raw); err != nil || len(raw) != 64 {
		t.Fatal("missing token hash", err)
	}
	sender.mu.Lock()
	sender.fail = false
	sender.mu.Unlock()
	must(owner, `UPDATE users SET role='lecturer' WHERE tenant_id=$1 AND role='hod'`, dept.ID)
	must(owner, `DELETE FROM user_role_assignments WHERE tenant_id=$1 AND role='hod'`, dept.ID)
	must(owner, `DELETE FROM role_assignment_logs WHERE tenant_id=$1 AND role='hod'`, dept.ID)
	if _, err = svc.Bootstrap(bound, Request{Email: "reopen@example.edu", Name: "Reopen"}); !errors.Is(err, ErrConflict) {
		t.Fatal("bootstrap reopened after HOD removal", err)
	}
}
