package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/aces/backend/internal/auth"
	db "github.com/aces/backend/internal/db/sql"
)

// This test needs a real Postgres with the repo's extensions (uuid-ossp, pgcrypto).
// It is skipped unless DB_SOURCE names a server whose user can create databases,
// the same way internal/tenant/integration_test.go works. It creates its own
// database, applies every up migration in order, runs the cases, and drops it.

const grantTestTenant = "00000000-0000-4000-8000-000000000001"

var (
	grantHod        = uuid.MustParse("10000000-0000-4000-8000-000000000001")
	grantAdmin      = uuid.MustParse("10000000-0000-4000-8000-000000000002") // primary role admin
	grantAssigned   = uuid.MustParse("10000000-0000-4000-8000-000000000003") // student with active admin assignment
	grantLecturer   = uuid.MustParse("10000000-0000-4000-8000-000000000004") // lecturer with active admin assignment
	grantExAdmin    = uuid.MustParse("10000000-0000-4000-8000-000000000006") // admin assignment inactive
	grantStudent    = uuid.MustParse("10000000-0000-4000-8000-000000000007")
	grantSeedStatic = []string{
		`INSERT INTO users (id, email, password_hash, role, first_name, last_name) VALUES
		 ('10000000-0000-4000-8000-000000000001','hod@x','x','hod','H','Od'),
		 ('10000000-0000-4000-8000-000000000002','adminA@x','x','admin','A','Primary'),
		 ('10000000-0000-4000-8000-000000000003','adminB@x','x','student','B','Assigned'),
		 ('10000000-0000-4000-8000-000000000004','lectAdmin@x','x','lecturer','C','LectAdmin'),
		 ('10000000-0000-4000-8000-000000000006','exAdmin@x','x','student','E','Revoked'),
		 ('10000000-0000-4000-8000-000000000007','stud@x','x','student','F','Plain')`,
		`INSERT INTO user_role_assignments (user_id, role, is_active, assigned_by) VALUES
		 ('10000000-0000-4000-8000-000000000003','admin',true,'10000000-0000-4000-8000-000000000001'),
		 ('10000000-0000-4000-8000-000000000004','admin',true,NULL),
		 ('10000000-0000-4000-8000-000000000006','admin',false,'10000000-0000-4000-8000-000000000001')`,
	}
)

func TestAdminGrantsPostgres(t *testing.T) {
	src := os.Getenv("DB_SOURCE")
	if src == "" {
		t.Skip("DB_SOURCE not set; skipping admin grant database test")
	}
	ctx := context.Background()

	dbName := fmt.Sprintf("aces_grants_test_%d", time.Now().UnixNano())
	setup, err := pgx.Connect(ctx, src)
	if err != nil {
		t.Fatalf("connect to DB_SOURCE: %v", err)
	}
	if _, err := setup.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{dbName}.Sanitize()); err != nil {
		t.Fatalf("create database: %v", err)
	}
	setup.Close(ctx)
	t.Cleanup(func() {
		c, err := pgx.Connect(context.Background(), src)
		if err != nil {
			return
		}
		defer c.Close(context.Background())
		_, _ = c.Exec(context.Background(), "DROP DATABASE IF EXISTS "+pgx.Identifier{dbName}.Sanitize()+" WITH (FORCE)")
	})

	u, err := url.Parse(src)
	if err != nil {
		t.Fatalf("parse DB_SOURCE: %v", err)
	}
	u.Path = "/" + dbName
	conn, err := pgx.Connect(ctx, u.String())
	if err != nil {
		t.Fatalf("connect to test database: %v", err)
	}
	defer conn.Close(ctx)

	applyGrantMigrations(t, conn)
	seedGrantFixtures(t, conn)

	queries := db.New(conn)
	server := &Server{store: queries}

	// requestAs builds a request context for the given caller, with the grant loader
	// run the same way the router runs it.
	requestAs := func(t *testing.T, id uuid.UUID, role string) *gin.Context {
		t.Helper()
		gin.SetMode(gin.TestMode)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)
		c.Set("claims", &auth.Claims{UserID: id.String(), Role: role})
		return c
	}
	loaded := func(t *testing.T, id uuid.UUID, role string) *gin.Context {
		t.Helper()
		c := requestAs(t, id, role)
		server.loadAdminGrant(c)
		if c.IsAborted() {
			t.Fatalf("grant loader aborted for %s", id)
		}
		return c
	}

	t.Run("holds role: primary, assigned, lecturer-with-assignment; not ex-admin or student", func(t *testing.T) {
		for _, tc := range []struct {
			name string
			id   uuid.UUID
			want bool
		}{
			{"primary admin", grantAdmin, true},
			{"student with active admin assignment", grantAssigned, true},
			{"lecturer with active admin assignment", grantLecturer, true},
			{"ex-admin with inactive assignment", grantExAdmin, false},
			{"plain student", grantStudent, false},
		} {
			got, err := queries.UserHoldsAdminRole(ctx, tc.id)
			if err != nil {
				t.Fatalf("%s: %v", tc.name, err)
			}
			if got != tc.want {
				t.Errorf("%s: UserHoldsAdminRole = %v, want %v", tc.name, got, tc.want)
			}
		}
	})

	t.Run("no grant means no admin capability", func(t *testing.T) {
		c := loaded(t, grantAdmin, "admin")
		for _, cap := range allAdminCapabilities {
			if isStaffCaller(c, cap) {
				t.Errorf("admin with no grant passed %s", cap)
			}
		}
	})

	t.Run("grant opens only the granted capabilities, on the server", func(t *testing.T) {
		g, err := queries.GrantAdminPermissions(ctx, db.GrantAdminPermissionsParams{
			UserID:           grantAdmin,
			CanManageResults: true,
			CanManageCourses: true,
			GrantedByHodID:   grantHod,
		})
		if err != nil {
			t.Fatalf("grant: %v", err)
		}
		if !g.IsActive || !g.CanManageResults || !g.CanManageCourses || g.CanManageFinance {
			t.Fatalf("unexpected grant row: %+v", g)
		}
		c := loaded(t, grantAdmin, "admin")
		if !isStaffCaller(c, capManageResults) {
			t.Error("granted results capability refused")
		}
		if isStaffCaller(c, capManageFinance) {
			t.Error("ungranted finance capability passed")
		}
		if isStaffCaller(c, capManageAlumni) {
			t.Error("ungranted alumni capability passed")
		}
	})

	t.Run("update changes flags of an active grant", func(t *testing.T) {
		g, err := queries.UpdateAdminPermissions(ctx, db.UpdateAdminPermissionsParams{
			UserID:           grantAdmin,
			CanManageResults: false,
			CanManageFinance: true,
		})
		if err != nil {
			t.Fatalf("update: %v", err)
		}
		if g.CanManageResults || !g.CanManageFinance {
			t.Fatalf("update did not apply: %+v", g)
		}
		c := loaded(t, grantAdmin, "admin")
		if isStaffCaller(c, capManageResults) || !isStaffCaller(c, capManageFinance) {
			t.Error("server check does not reflect the updated grant")
		}
	})

	t.Run("a grant does not survive removal of the admin role", func(t *testing.T) {
		// Make the assigned admin a plain student: the grant must stop working at once.
		if _, err := queries.GrantAdminPermissions(ctx, db.GrantAdminPermissionsParams{
			UserID: grantAssigned, CanManageCourses: true, GrantedByHodID: grantHod,
		}); err != nil {
			t.Fatalf("grant assigned admin: %v", err)
		}
		if !isStaffCallerAfter(t, server, grantAssigned, capManageCourses) {
			t.Fatal("precondition: assigned admin should pass with a grant")
		}
		mustExecGrant(t, conn, `UPDATE user_role_assignments SET is_active = false WHERE user_id = $1`, grantAssigned)
		if isStaffCallerAfter(t, server, grantAssigned, capManageCourses) {
			t.Error("grant still works after the admin assignment was removed")
		}
		// The role-removal path clears the grant, so a later re-assignment starts clean.
		c := requestAs(t, grantAssigned, "student")
		if err := server.dropGrantIfNoAdminRole(c, grantAssigned); err != nil {
			t.Fatalf("drop grant: %v", err)
		}
		var active bool
		var courses bool
		if err := conn.QueryRow(ctx, `SELECT is_active, can_manage_courses FROM admin_permissions WHERE user_id = $1`, grantAssigned).Scan(&active, &courses); err != nil {
			t.Fatalf("read row: %v", err)
		}
		if active || courses {
			t.Errorf("grant not cleared on role removal: is_active=%v can_manage_courses=%v", active, courses)
		}
	})

	t.Run("revoke switches every flag off and the person loses admin capability", func(t *testing.T) {
		if err := queries.RevokeAdminPermissions(ctx, grantAdmin); err != nil {
			t.Fatalf("revoke: %v", err)
		}
		if _, err := queries.GetAdminPermissions(ctx, grantAdmin); err == nil {
			t.Error("revoked grant still readable as active")
		}
		c := loaded(t, grantAdmin, "admin")
		for _, cap := range allAdminCapabilities {
			if isStaffCaller(c, cap) {
				t.Errorf("revoked admin still passed %s", cap)
			}
		}
	})

	t.Run("a re-grant after revoke starts from exactly the new flags", func(t *testing.T) {
		g, err := queries.GrantAdminPermissions(ctx, db.GrantAdminPermissionsParams{
			UserID: grantAdmin, CanViewAnalytics: true, GrantedByHodID: grantHod,
		})
		if err != nil {
			t.Fatalf("re-grant: %v", err)
		}
		if g.CanManageResults || g.CanManageFinance || !g.CanViewAnalytics {
			t.Errorf("re-grant kept stale flags: %+v", g)
		}
	})

	t.Run("HOD is not subject to grants", func(t *testing.T) {
		c := loaded(t, grantHod, "hod")
		for _, cap := range allAdminCapabilities {
			if !isStaffCaller(c, cap) {
				t.Errorf("hod refused %s", cap)
			}
		}
	})

	t.Run("grant handler refuses a person without the admin role", func(t *testing.T) {
		c := requestAs(t, grantHod, "hod")
		body := fmt.Sprintf(`{"user_id":%q,"can_manage_results":true}`, grantStudent)
		c.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
		server.grantAdminPermission(c)
		if c.Writer.Status() != http.StatusBadRequest {
			t.Errorf("grant to a student: status %d, want 400", c.Writer.Status())
		}
		if _, err := queries.GetAdminPermissions(ctx, grantStudent); err == nil {
			t.Error("a grant row was created for a student")
		}
	})

	t.Run("update and read of a missing grant return 404", func(t *testing.T) {
		c := requestAs(t, grantHod, "hod")
		c.Params = gin.Params{{Key: "user_id", Value: grantStudent.String()}}
		c.Request = httptest.NewRequest(http.MethodPut, "/", strings.NewReader(`{"can_manage_results":true}`))
		c.Request.Header.Set("Content-Type", "application/json")
		server.updateAdminPermission(c)
		if c.Writer.Status() != http.StatusNotFound {
			t.Errorf("update of missing grant: status %d, want 404", c.Writer.Status())
		}

		c2 := requestAs(t, grantHod, "hod")
		c2.Params = gin.Params{{Key: "user_id", Value: grantStudent.String()}}
		server.getAdminPermission(c2)
		if c2.Writer.Status() != http.StatusNotFound {
			t.Errorf("get of missing grant: status %d, want 404", c2.Writer.Status())
		}
	})
}

// isStaffCallerAfter runs the grant loader for id and reports whether the capability passes.
func isStaffCallerAfter(t *testing.T, server *Server, id uuid.UUID, cap AdminCapability) bool {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Set("claims", &auth.Claims{UserID: id.String(), Role: "admin"})
	server.loadAdminGrant(c)
	return isStaffCaller(c, cap)
}

func applyGrantMigrations(t *testing.T, conn *pgx.Conn) {
	t.Helper()
	// ACES_MIGRATIONS_DIR lets a server without the uuid-ossp/pgcrypto extensions run
	// the same migrations from a copy with those lines removed. Unset, the repo's own
	// migrations are used.
	dir := os.Getenv("ACES_MIGRATIONS_DIR")
	if dir == "" {
		dir = filepath.Join("..", "db", "migrations")
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil || len(files) == 0 {
		t.Fatalf("find migrations in %s: %v (found %d)", dir, err, len(files))
	}
	sort.Strings(files)
	for _, f := range files {
		sqlBytes, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		if _, err := conn.Exec(context.Background(), string(sqlBytes)); err != nil {
			t.Fatalf("apply %s: %v", filepath.Base(f), err)
		}
	}
}

func seedGrantFixtures(t *testing.T, conn *pgx.Conn) {
	t.Helper()
	ctx := context.Background()
	if _, err := conn.Exec(ctx, "SELECT set_config('app.tenant_id', $1, false)", grantTestTenant); err != nil {
		t.Fatalf("set tenant: %v", err)
	}
	for _, q := range grantSeedStatic {
		if _, err := conn.Exec(ctx, q); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
}

func mustExecGrant(t *testing.T, conn *pgx.Conn, q string, args ...any) {
	t.Helper()
	if _, err := conn.Exec(context.Background(), q, args...); err != nil {
		t.Fatalf("exec %q: %v", q, err)
	}
}
