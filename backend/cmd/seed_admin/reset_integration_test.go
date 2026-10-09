package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/tenant"
	"github.com/aces/backend/internal/util"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// These tests need a PostgreSQL server on which the caller may create databases
// and roles, as the tenant tests do. They are skipped unless DB_SOURCE is set,
// for example:
//
//	DB_SOURCE=postgres://postgres@127.0.0.1:5432/postgres?sslmode=disable go test ./cmd/seed_admin/
//
// Each run creates its own database, applies every up migration, and runs the
// application queries as a NOLOGIN role that is neither a superuser nor a table
// owner, so row-level security applies as it does in production.

// resetEnv returns a tenant manager whose pools run as the restricted role, and
// a superuser connection for setup. The database and role are dropped afterwards.
func resetEnv(t *testing.T) (*tenant.Manager, *pgx.Conn) {
	t.Helper()
	src := os.Getenv("DB_SOURCE")
	if src == "" {
		t.Skip("DB_SOURCE not set; skipping database integration test")
	}
	ctx := context.Background()

	suffix := resetRandomSuffix(t)
	dbName := "aces_seed_reset_" + suffix
	role := "aces_seed_reset_rt_" + suffix
	dbIdent := pgx.Identifier{dbName}.Sanitize()
	roleIdent := pgx.Identifier{role}.Sanitize()

	srcURL, err := url.Parse(src)
	if err != nil {
		t.Fatalf("parse DB_SOURCE: %v", err)
	}
	setup, err := pgx.Connect(ctx, src)
	if err != nil {
		t.Fatalf("connect to DB_SOURCE: %v", err)
	}
	resetExec(t, setup, "CREATE DATABASE "+dbIdent)
	setup.Close(ctx)
	t.Cleanup(func() {
		c, err := pgx.Connect(context.Background(), src)
		if err != nil {
			t.Logf("cleanup: connect: %v", err)
			return
		}
		defer c.Close(context.Background())
		_, _ = c.Exec(context.Background(), "DROP DATABASE IF EXISTS "+dbIdent+" WITH (FORCE)")
		_, _ = c.Exec(context.Background(), "DROP ROLE IF EXISTS "+roleIdent)
	})

	testURL := *srcURL
	testURL.Path = "/" + dbName
	dsn := testURL.String()
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("connect to test database: %v", err)
	}
	// Registered after the drop, so it runs first and the connection closes
	// before the database is dropped.
	t.Cleanup(func() { admin.Close(context.Background()) })

	resetApplyMigrations(t, admin)
	resetExec(t, admin, "CREATE ROLE "+roleIdent+" NOLOGIN")
	for _, stmt := range []string{
		"GRANT USAGE ON SCHEMA public TO " + roleIdent,
		"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO " + roleIdent,
		"GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO " + roleIdent,
		"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO " + roleIdent,
	} {
		resetExec(t, admin, stmt)
	}

	mgr, err := tenant.NewManager(ctx, dsn, tenant.Options{DefaultSlug: "uniuyo-ce", RuntimeRole: role})
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}
	t.Cleanup(mgr.Close)
	return mgr, admin
}

func resetRandomSuffix(t *testing.T) string {
	t.Helper()
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("random suffix: %v", err)
	}
	return hex.EncodeToString(b)
}

// resetApplyMigrations runs every up migration in order. The file names start
// with a zero-padded number, so lexical order is migration order.
func resetApplyMigrations(t *testing.T, conn *pgx.Conn) {
	t.Helper()
	files, err := filepath.Glob(filepath.Join("..", "..", "internal", "db", "migrations", "*.up.sql"))
	if err != nil || len(files) == 0 {
		t.Fatalf("find migrations: %v (found %d)", err, len(files))
	}
	sort.Strings(files)
	for _, f := range files {
		sql, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		if _, err := conn.Exec(context.Background(), string(sql)); err != nil {
			t.Fatalf("apply %s: %v", filepath.Base(f), err)
		}
	}
}

func resetExec(t *testing.T, conn *pgx.Conn, sql string, args ...any) {
	t.Helper()
	if _, err := conn.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("exec %q: %v", sql, err)
	}
}

// resetTenant registers a department directly in the registry.
func resetTenant(t *testing.T, admin *pgx.Conn, slug string) tenant.Tenant {
	t.Helper()
	id := uuid.New()
	resetExec(t, admin, `INSERT INTO tenants (id, slug, name) VALUES ($1, $2, $3)`, id, slug, "Department "+slug)
	return tenant.Tenant{ID: id, Slug: slug, Name: "Department " + slug, IsActive: true}
}

// resetIn returns a context bound to tn, as the HTTP middleware does for a request.
func resetIn(tn tenant.Tenant) context.Context {
	return tenant.With(context.Background(), tn)
}

// resetUser creates an account in tn through the application's own query.
func resetUser(t *testing.T, mgr *tenant.Manager, tn tenant.Tenant, email string, role db.UserRole, password string) db.User {
	t.Helper()
	hashed, err := util.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	u, err := db.New(mgr.DB()).CreateUser(resetIn(tn), db.CreateUserParams{
		Email:        email,
		PasswordHash: hashed,
		Role:         role,
		FirstName:    "First",
		LastName:     "Last",
	})
	if err != nil {
		t.Fatalf("create %s in %s: %v", email, tn.Slug, err)
	}
	return u
}

func resetLoad(t *testing.T, mgr *tenant.Manager, tn tenant.Tenant, email string) db.User {
	t.Helper()
	u, err := db.New(mgr.DB()).GetUserByEmail(resetIn(tn), email)
	if err != nil {
		t.Fatalf("load %s in %s: %v", email, tn.Slug, err)
	}
	return u
}

func TestSeedPasswordResetChangesOnlyTheNamedDepartmentsAccount(t *testing.T) {
	mgr, admin := resetEnv(t)
	a := resetTenant(t, admin, "reset-a")
	b := resetTenant(t, admin, "reset-b")
	const email = "admin@example.test"
	const oldA, freshA, pinB = "old-password-a", "fresh-password-a", "password-in-b"

	aAdmin := resetUser(t, mgr, a, email, db.UserRoleAdmin, oldA)
	resetUser(t, mgr, b, email, db.UserRoleAdmin, pinB)

	// Give the department A admin a live session, so the reset has something to clear.
	q := db.New(mgr.DB())
	if _, err := q.CreateActiveSession(resetIn(a), db.CreateActiveSessionParams{
		UserID:       aAdmin.ID,
		SessionToken: "refresh-token-a",
		ExpiresAt:    pgtype.Timestamptz{Time: time.Now().Add(time.Hour), Valid: true},
	}); err != nil {
		t.Fatal(err)
	}
	if sessions, err := q.ListUserSessions(resetIn(a), aAdmin.ID); err != nil || len(sessions) != 1 {
		t.Fatalf("before the reset: want one live session, got %d (err %v)", len(sessions), err)
	}

	hashed, err := util.HashPassword(freshA)
	if err != nil {
		t.Fatal(err)
	}
	if err := applySeedPasswordReset(resetIn(a), mgr.DB(), email, db.UserRoleAdmin, hashed); err != nil {
		t.Fatalf("reset: %v", err)
	}

	got := resetLoad(t, mgr, a, email)
	if err := util.CheckPassword(freshA, got.PasswordHash); err != nil {
		t.Fatalf("the new password is refused: %v", err)
	}
	if util.CheckPassword(oldA, got.PasswordHash) == nil {
		t.Fatal("the old password still works after the reset")
	}
	if sessions, err := q.ListUserSessions(resetIn(a), aAdmin.ID); err != nil || len(sessions) != 0 {
		t.Fatalf("sessions survive the reset: %d (err %v)", len(sessions), err)
	}

	// The same email in another department is a different account and must not change.
	other := resetLoad(t, mgr, b, email)
	if err := util.CheckPassword(pinB, other.PasswordHash); err != nil {
		t.Fatalf("the reset changed the same email's account in another department: %v", err)
	}
}

func TestSeedPasswordResetRefusesOtherRolesAndMissingAccounts(t *testing.T) {
	mgr, admin := resetEnv(t)
	tn := resetTenant(t, admin, "reset-c")
	const studentEmail, studentPass = "student@example.test", "student-password"
	resetUser(t, mgr, tn, studentEmail, db.UserRoleStudent, studentPass)

	hashed, err := util.HashPassword("never-applied")
	if err != nil {
		t.Fatal(err)
	}

	err = applySeedPasswordReset(resetIn(tn), mgr.DB(), studentEmail, db.UserRoleAdmin, hashed)
	if err == nil || !strings.Contains(err.Error(), "not reset here") {
		t.Fatalf("a student account was reset as an admin: %v", err)
	}
	if err := util.CheckPassword(studentPass, resetLoad(t, mgr, tn, studentEmail).PasswordHash); err != nil {
		t.Fatalf("the student's password changed after a refused reset: %v", err)
	}

	err = applySeedPasswordReset(resetIn(tn), mgr.DB(), "nobody@example.test", db.UserRoleAdmin, hashed)
	if !errors.Is(err, errNoSeededAccount) {
		t.Fatalf("a missing account was not reported as such: %v", err)
	}
}
