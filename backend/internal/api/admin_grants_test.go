package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/aces/backend/internal/auth"
	db "github.com/aces/backend/internal/db/sql"
)

// withGrant puts an active grant with exactly the given capabilities into the
// test request, the way loadAdminGrant does for a delegated admin.
func withGrant(c *gin.Context, caps ...AdminCapability) {
	var g db.AdminPermission
	g.IsActive = true
	for _, cap := range caps {
		switch cap {
		case capManageResults:
			g.CanManageResults = true
		case capManageUsers:
			g.CanManageUsers = true
		case capManageFinance:
			g.CanManageFinance = true
		case capManageCourses:
			g.CanManageCourses = true
		case capViewAnalytics:
			g.CanViewAnalytics = true
		case capManageAnnouncements:
			g.CanManageAnnouncements = true
		case capBackupData:
			g.CanBackupData = true
		case capManageComplaints:
			g.CanManageComplaints = true
		case capManageAlumni:
			g.CanManageAlumni = true
		case capManageCourseForms:
			g.CanManageCourseForms = true
		case capManageSettings:
			g.CanManageSettings = true
		}
	}
	c.Set(adminGrantContextKey, g)
}

// ─── capability gate: staffAccess / isStaffCaller / isStaffRole ─────────────

func reqWith(claims *auth.Claims) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	if claims != nil {
		c.Set("claims", claims)
	}
	return c
}

// A delegated admin with no grant is refused everywhere; a grant opens exactly the
// capability it names and no other.
func TestDelegatedAdminWithoutGrantIsNotStaff(t *testing.T) {
	for _, role := range []string{"admin", "delegated_admin"} {
		c := reqWith(&auth.Claims{Role: role})
		for _, cap := range allAdminCapabilities {
			if isStaffCaller(c, cap) {
				t.Errorf("%s with no grant passed %s", role, cap)
			}
			if isStaffRole(c, cap) {
				t.Errorf("%s with no grant passed isStaffRole %s", role, cap)
			}
		}
	}
}

func TestGrantOpensOnlyItsOwnCapability(t *testing.T) {
	for _, granted := range allAdminCapabilities {
		c := reqWith(&auth.Claims{Role: "delegated_admin"})
		withGrant(c, granted)
		for _, asked := range allAdminCapabilities {
			want := asked == granted
			if got := isStaffCaller(c, asked); got != want {
				t.Errorf("grant %s: isStaffCaller(%s) = %v, want %v", granted, asked, got, want)
			}
		}
	}
}

// The HOD is never subject to a grant.
func TestHodNeedsNoGrant(t *testing.T) {
	c := reqWith(&auth.Claims{Role: "hod"})
	for _, cap := range allAdminCapabilities {
		if !isStaffCaller(c, cap) {
			t.Errorf("hod refused for %s", cap)
		}
	}
}

// Bursars keep their finance access (isStaffRole) without a grant, as before.
func TestBursarKeepsFinanceAccess(t *testing.T) {
	c := reqWith(&auth.Claims{Role: "bursar_dept"})
	if !isStaffRole(c, capManageFinance) {
		t.Error("bursar_dept should pass finance checks")
	}
	// Bursars are not admin-tier, so they never pass the handler-level staff
	// check (isStaffCaller), which is HOD and admin only.
	if isStaffCaller(reqWith(&auth.Claims{Role: "bursar_dept"}), capManageFinance) {
		t.Error("bursar_dept should not pass isStaffCaller")
	}
}

// A lecturer or class rep is not an admin-tier role, so their own access is unchanged.
func TestNonAdminRolesUnchanged(t *testing.T) {
	if isStaffCaller(reqWith(&auth.Claims{Role: "lecturer"}), capManageResults) {
		t.Error("lecturer should not be staff")
	}
	if isStaffCaller(reqWith(&auth.Claims{Role: "student"}), capManageResults) {
		t.Error("student should not be staff")
	}
}

// Admin-tier role held as an additional role still needs a grant.
func TestAdditionalAdminRoleNeedsGrant(t *testing.T) {
	c := reqWith(&auth.Claims{Role: "student", Roles: "admin"})
	if isStaffCaller(c, capManageCourses) {
		t.Error("admin via additional role passed with no grant")
	}
	withGrant(c, capManageCourses)
	if !isStaffCaller(c, capManageCourses) {
		t.Error("admin via additional role with grant should pass")
	}
}

// A route gate refuses an admin without the grant and passes one with it.
func TestRequireCapabilityRoute(t *testing.T) {
	gate := requireCapability(capManageResults, "hod", "admin", "delegated_admin")

	run := func(claims *auth.Claims, grant bool) int {
		gin.SetMode(gin.TestMode)
		w := httptest.NewRecorder()
		router := gin.New()
		router.GET("/x", func(c *gin.Context) {
			if claims != nil {
				c.Set("claims", claims)
			}
			if grant {
				withGrant(c, capManageResults)
			}
			c.Next()
		}, gate, func(c *gin.Context) { c.Status(http.StatusOK) })
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		router.ServeHTTP(w, req)
		return w.Code
	}

	if code := run(&auth.Claims{Role: "delegated_admin"}, false); code != http.StatusForbidden {
		t.Errorf("delegated admin without grant: got %d, want 403", code)
	}
	if code := run(&auth.Claims{Role: "delegated_admin"}, true); code != http.StatusOK {
		t.Errorf("delegated admin with grant: got %d, want 200", code)
	}
	if code := run(&auth.Claims{Role: "hod"}, false); code != http.StatusOK {
		t.Errorf("hod: got %d, want 200", code)
	}
	if code := run(&auth.Claims{Role: "lecturer"}, false); code != http.StatusForbidden {
		t.Errorf("lecturer on admin route: got %d, want 403", code)
	}
	if code := run(nil, false); code != http.StatusUnauthorized {
		t.Errorf("no claims: got %d, want 401", code)
	}
}

// Every capability has a database column and a grant flag. This guards against a
// capability being added to the list without being wired into grantAllows.
func TestEveryCapabilityIsWired(t *testing.T) {
	seen := map[AdminCapability]bool{}
	for _, c := range allAdminCapabilities {
		if seen[c] {
			t.Errorf("duplicate capability %s", c)
		}
		seen[c] = true
		var g db.AdminPermission
		if grantAllows(g, c) {
			t.Errorf("%s reports true for an empty grant", c)
		}
		c2 := reqWith(&auth.Claims{Role: "admin"})
		withGrant(c2, c)
		if !isStaffCaller(c2, c) {
			t.Errorf("%s is not wired into grantAllows", c)
		}
	}
	if len(allAdminCapabilities) != 11 {
		t.Errorf("expected 11 capabilities, got %d", len(allAdminCapabilities))
	}
}
