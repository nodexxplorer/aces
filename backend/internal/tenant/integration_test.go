package tenant_test

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

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// These tests need a PostgreSQL server on which the caller may create
// databases and roles (CI provides one). They are skipped unless DB_SOURCE is
// set, for example:
//
//	DB_SOURCE=postgres://postgres@127.0.0.1:5432/postgres?sslmode=disable go test ./internal/tenant/
//
// Each run creates its own database, applies every up migration, and runs the
// application queries as a NOLOGIN role that is neither a superuser nor a table
// owner, so row-level security applies exactly as it does in production.

const legacySlug = "uniuyo-ce"

type env struct {
	t     *testing.T
	ctx   context.Context
	dsn   string          // connection string of the test database, as the admin role
	mgr   *tenant.Manager // pools connect as the restricted runtime role
	admin *pgx.Conn       // superuser connection; bypasses RLS, used for seeding only
}

func newEnv(t *testing.T) *env {
	t.Helper()
	src := os.Getenv("DB_SOURCE")
	if src == "" {
		t.Skip("DB_SOURCE not set; skipping database integration test")
	}
	ctx := context.Background()

	suffix := randomSuffix(t)
	dbName := "aces_tenant_test_" + suffix
	role := "aces_tenant_rt_" + suffix
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
	mustExec(t, setup, "CREATE DATABASE "+dbIdent)
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
	// Registered after the drop, so it runs first: the connection closes
	// before the database is dropped.
	t.Cleanup(func() { admin.Close(context.Background()) })

	applyMigrations(t, admin)

	mustExec(t, admin, "CREATE ROLE "+roleIdent+" NOLOGIN")
	for _, stmt := range []string{
		"GRANT USAGE ON SCHEMA public TO " + roleIdent,
		"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO " + roleIdent,
		"GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO " + roleIdent,
		"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO " + roleIdent,
	} {
		mustExec(t, admin, stmt)
	}

	mgr, err := tenant.NewManager(ctx, dsn, tenant.Options{DefaultSlug: legacySlug, RuntimeRole: role})
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}
	t.Cleanup(mgr.Close)

	return &env{t: t, ctx: ctx, dsn: dsn, mgr: mgr, admin: admin}
}

func randomSuffix(t *testing.T) string {
	t.Helper()
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("random suffix: %v", err)
	}
	return hex.EncodeToString(b)
}

// applyMigrations runs every up migration in order. The file names start with
// a zero-padded number, so lexical order is migration order.
func applyMigrations(t *testing.T, conn *pgx.Conn) {
	t.Helper()
	files, err := filepath.Glob(filepath.Join("..", "db", "migrations", "*.up.sql"))
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

func mustExec(t *testing.T, conn *pgx.Conn, sql string, args ...any) {
	t.Helper()
	if _, err := conn.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("exec %q: %v", firstLine(sql), err)
	}
}

// newTenant registers a department directly in the registry.
func (e *env) newTenant(slug string) tenant.Tenant {
	e.t.Helper()
	id := uuid.New()
	mustExec(e.t, e.admin, `INSERT INTO tenants (id, slug, name) VALUES ($1, $2, $3)`, id, slug, "Department "+slug)
	return tenant.Tenant{ID: id, Slug: slug, Name: "Department " + slug, IsActive: true}
}

// in returns a context bound to tn, as the HTTP middleware does for a request.
func in(tn tenant.Tenant) context.Context {
	return tenant.With(context.Background(), tn)
}

// newUser creates a student account in tn through the application's own query.
func (e *env) newUser(tn tenant.Tenant, email string) uuid.UUID {
	e.t.Helper()
	u, err := db.New(e.mgr.DB()).CreateUser(in(tn), db.CreateUserParams{
		Email:        email,
		PasswordHash: "x",
		Role:         db.UserRoleStudent,
		FirstName:    "First",
		LastName:     "Last",
	})
	if err != nil {
		e.t.Fatalf("create user %s in %s: %v", email, tn.Slug, err)
	}
	return u.ID
}

// newStudent creates the student profile for a user and returns its ID.
func (e *env) newStudent(tn tenant.Tenant, userID uuid.UUID) uuid.UUID {
	e.t.Helper()
	var id uuid.UUID
	if err := e.mgr.DB().QueryRow(in(tn), `INSERT INTO students (user_id) VALUES ($1) RETURNING id`, userID).Scan(&id); err != nil {
		e.t.Fatalf("create student in %s: %v", tn.Slug, err)
	}
	return id
}

// newDuesPayment records a department-dues payment for a student.
func (e *env) newDuesPayment(tn tenant.Tenant, studentID uuid.UUID, paystackRef string) uuid.UUID {
	e.t.Helper()
	var id uuid.UUID
	err := e.mgr.DB().QueryRow(in(tn),
		`INSERT INTO payments (student_id, type, item_name, amount, paystack_reference)
		 VALUES ($1, 'dept_dues', 'Department dues', 5000, NULLIF($2, ''))
		 RETURNING id`, studentID, paystackRef).Scan(&id)
	if err != nil {
		e.t.Fatalf("create payment in %s: %v", tn.Slug, err)
	}
	return id
}

// userIDsByEmail returns the IDs of the users with this email that the bound
// context can see.
func (e *env) userIDsByEmail(ctx context.Context, email string) ([]uuid.UUID, error) {
	rows, err := e.mgr.DB().Query(ctx, `SELECT id FROM users WHERE email = $1`, email)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[uuid.UUID])
}

func pgCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i] + " …"
	}
	return s
}

// TestDatabaseTenancy runs the database-level checks against one migrated
// database. The subtests share state and run in order.
func TestDatabaseTenancy(t *testing.T) {
	e := newEnv(t)

	t.Run("runtime role is restricted", func(t *testing.T) {
		if err := e.mgr.CheckRuntimeRole(e.ctx, false); err != nil {
			t.Fatalf("restricted runtime role rejected: %v", err)
		}

		// Without RuntimeRole the pools connect as the superuser, which
		// bypasses RLS. The check must refuse that unless explicitly allowed.
		privileged, err := tenant.NewManager(e.ctx, e.dsn, tenant.Options{DefaultSlug: legacySlug})
		if err != nil {
			t.Fatalf("NewManager: %v", err)
		}
		defer privileged.Close()
		if err := privileged.CheckRuntimeRole(e.ctx, false); !errors.Is(err, tenant.ErrUnsafeRole) {
			t.Fatalf("superuser role accepted: %v", err)
		}
		if err := privileged.CheckRuntimeRole(e.ctx, true); err != nil {
			t.Fatalf("allowUnsafe should permit the superuser role: %v", err)
		}
	})

	t.Run("legacy tenant is seeded and is the default", func(t *testing.T) {
		def, err := e.mgr.Resolve(e.ctx, "")
		if err != nil {
			t.Fatalf("resolve default: %v", err)
		}
		if def.ID != tenant.LegacyID || def.Slug != legacySlug || !def.IsActive {
			t.Fatalf("default tenant = %+v, want the legacy tenant", def)
		}
	})

	t.Run("unknown department is not found", func(t *testing.T) {
		if _, err := e.mgr.Resolve(e.ctx, "no-such-dept"); !errors.Is(err, tenant.ErrNotFound) {
			t.Fatalf("Resolve(unknown) = %v, want ErrNotFound", err)
		}
	})

	legacy := tenant.Tenant{ID: tenant.LegacyID, Slug: legacySlug, IsActive: true}
	deptA := e.newTenant("dept-a")
	deptB := e.newTenant("dept-b")

	var legacyUser, userA, userB uuid.UUID
	t.Run("accounts are per department", func(t *testing.T) {
		legacyUser = e.newUser(legacy, "same@uniuyo.test")
		userA = e.newUser(deptA, "same@uniuyo.test")
		userB = e.newUser(deptB, "same@uniuyo.test")

		_, err := db.New(e.mgr.DB()).CreateUser(in(deptA), db.CreateUserParams{
			Email: "same@uniuyo.test", PasswordHash: "x", Role: db.UserRoleStudent, FirstName: "A", LastName: "Dup",
		})
		if pgCode(err) != "23505" {
			t.Fatalf("duplicate email inside one department: got %v, want unique violation 23505", err)
		}
	})

	t.Run("reads only see the bound department", func(t *testing.T) {
		for _, tc := range []struct {
			name string
			ctx  context.Context
			want uuid.UUID
		}{
			{"dept-a", in(deptA), userA},
			{"dept-b", in(deptB), userB},
			{"legacy", in(legacy), legacyUser},
		} {
			ids, err := e.userIDsByEmail(tc.ctx, "same@uniuyo.test")
			if err != nil {
				t.Fatalf("%s: %v", tc.name, err)
			}
			if len(ids) != 1 || ids[0] != tc.want {
				t.Fatalf("%s sees %v, want exactly its own user %s", tc.name, ids, tc.want)
			}
		}
	})

	t.Run("an unbound connection sees no tenant rows", func(t *testing.T) {
		ids, err := e.userIDsByEmail(context.Background(), "same@uniuyo.test")
		if err != nil {
			t.Fatal(err)
		}
		if len(ids) != 0 {
			t.Fatalf("unbound query saw %d user rows; it must fail closed", len(ids))
		}
	})

	t.Run("writes cannot target another department", func(t *testing.T) {
		_, err := e.mgr.DB().Exec(in(deptA),
			`INSERT INTO notifications (tenant_id, user_id, type, title, message) VALUES ($1, $2, 'general', 't', 'm')`,
			deptB.ID, userA)
		if pgCode(err) != "42501" {
			t.Fatalf("cross-department insert: got %v, want RLS violation 42501", err)
		}

		_, err = e.mgr.DB().Exec(context.Background(),
			`INSERT INTO notifications (user_id, type, title, message) VALUES ($1, 'general', 't', 'm')`, userA)
		if err == nil {
			t.Fatal("insert with no department bound was accepted")
		}
	})

	t.Run("updates and deletes cannot reach another department", func(t *testing.T) {
		tag, err := e.mgr.DB().Exec(in(deptB), `UPDATE users SET first_name = 'Hacked' WHERE id = $1`, userA)
		if err != nil {
			t.Fatal(err)
		}
		if tag.RowsAffected() != 0 {
			t.Fatalf("cross-department update affected %d rows", tag.RowsAffected())
		}
		tag, err = e.mgr.DB().Exec(in(deptB), `DELETE FROM users WHERE id = $1`, userA)
		if err != nil {
			t.Fatal(err)
		}
		if tag.RowsAffected() != 0 {
			t.Fatalf("cross-department delete affected %d rows", tag.RowsAffected())
		}
	})

	var studentA, studentB uuid.UUID
	t.Run("references cannot point at another department", func(t *testing.T) {
		studentA = e.newStudent(deptA, userA)

		// A department-B notification that names a department-A user. The
		// composite key (tenant_id, user_id) must reject it, because the
		// referential check runs without RLS.
		_, err := e.mgr.DB().Exec(in(deptB),
			`INSERT INTO notifications (user_id, type, title, message) VALUES ($1, 'general', 't', 'm')`, userA)
		if pgCode(err) != "23503" {
			t.Fatalf("cross-department reference: got %v, want foreign key violation 23503", err)
		}

		if _, err := e.mgr.DB().Exec(in(deptA),
			`INSERT INTO notifications (user_id, type, title, message) VALUES ($1, 'general', 't', 'm')`, userA); err != nil {
			t.Fatalf("same-department reference rejected: %v", err)
		}
	})

	var unsubA string
	const payRefB = "ACES-test-ref-b"
	t.Run("token lookups resolve the owning department", func(t *testing.T) {
		if _, err := e.mgr.DB().Exec(in(deptB), `UPDATE users SET calendar_feed_token = 'cal-b' WHERE id = $1`, userB); err != nil {
			t.Fatal(err)
		}
		var err error
		unsubA, err = db.New(e.mgr.DB()).GetOrCreateNotificationUnsubscribeToken(in(deptA), userA)
		if err != nil {
			t.Fatalf("create unsubscribe token: %v", err)
		}
		studentB = e.newStudent(deptB, userB)
		e.newDuesPayment(deptB, studentB, payRefB)

		lookup := func(fn, key string) *uuid.UUID {
			t.Helper()
			var id *uuid.UUID
			if err := e.mgr.DB().QueryRow(context.Background(), "SELECT "+fn+"($1)", key).Scan(&id); err != nil {
				t.Fatalf("%s(%q): %v", fn, key, err)
			}
			return id
		}

		if got := lookup("tenant_for_calendar_token", "cal-b"); got == nil || *got != deptB.ID {
			t.Fatalf("calendar token resolved to %v, want %s", got, deptB.ID)
		}
		if got := lookup("tenant_for_unsubscribe_token", unsubA); got == nil || *got != deptA.ID {
			t.Fatalf("unsubscribe token resolved to %v, want %s", got, deptA.ID)
		}
		if got := lookup("tenant_for_paystack_reference", payRefB); got == nil || *got != deptB.ID {
			t.Fatalf("payment reference resolved to %v, want %s", got, deptB.ID)
		}
		if got := lookup("tenant_for_calendar_token", "no-such-token"); got != nil {
			t.Fatalf("unknown token resolved to %v", got)
		}
	})

	t.Run("ON CONFLICT targets are scoped to the department", func(t *testing.T) {
		q := db.New(e.mgr.DB())
		first, err := q.GetOrCreateAISettings(in(deptA), userA)
		if err != nil {
			t.Fatalf("first upsert: %v", err)
		}
		second, err := q.GetOrCreateAISettings(in(deptA), userA)
		if err != nil {
			t.Fatalf("second upsert: %v", err)
		}
		if first.ID != second.ID {
			t.Fatalf("second upsert created a different row (%s vs %s)", first.ID, second.ID)
		}
		// The same user ID would conflict if the target lacked tenant_id.
		// Department B's row for its own user must not collide with A's.
		if _, err := q.GetOrCreateAISettings(in(deptB), userB); err != nil {
			t.Fatalf("upsert in another department: %v", err)
		}

		tok, err := q.GetOrCreateNotificationUnsubscribeToken(in(deptA), userA)
		if err != nil {
			t.Fatalf("second unsubscribe upsert: %v", err)
		}
		if tok != unsubA {
			t.Fatalf("unsubscribe token changed on second call")
		}
	})

	t.Run("receipt numbers are per department", func(t *testing.T) {
		q := db.New(e.mgr.DB())
		payA := e.newDuesPayment(deptA, studentA, "")
		payB := e.newDuesPayment(deptB, studentB, "")

		number := func(tn tenant.Tenant, id uuid.UUID, want int32) {
			t.Helper()
			got, err := q.AssignReceiptNumber(in(tn), id, db.PaymentTypeDeptDues)
			if err != nil {
				t.Fatalf("assign receipt in %s: %v", tn.Slug, err)
			}
			if got != want {
				t.Fatalf("receipt in %s = %d, want %d", tn.Slug, got, want)
			}
		}
		number(deptA, payA, 1)
		number(deptA, payA, 1) // re-issuing keeps the number and takes none
		number(deptB, payB, 1) // department B has its own book
		payA2 := e.newDuesPayment(deptA, studentA, "")
		number(deptA, payA2, 2)
	})

	t.Run("deactivated departments cannot be bound", func(t *testing.T) {
		gone := e.newTenant("dept-gone")
		mustExec(t, e.admin, `UPDATE tenants SET is_active = false WHERE id = $1`, gone.ID)
		if _, err := e.mgr.Bind(e.ctx, gone.ID); !errors.Is(err, tenant.ErrInactive) {
			t.Fatalf("Bind(inactive) = %v, want ErrInactive", err)
		}
	})
}
