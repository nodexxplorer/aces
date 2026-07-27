package api

import (
	"net/http/httptest"
	"testing"

	"github.com/aces/backend/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestIsStaffRole_Admin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "admin", Roles: ""})

	if !isStaffRole(c) {
		t.Error("admin should be staff")
	}
}

func TestIsStaffRole_Student(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "student", Roles: ""})

	if isStaffRole(c) {
		t.Error("student should not be staff")
	}
}

func TestIsStaffRole_Hod(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "hod", Roles: ""})

	if !isStaffRole(c) {
		t.Error("hod should be staff")
	}
}

func TestIsStaffRole_DelegatedAdminViaAdditionalRoles(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "student", Roles: "delegated_admin"})

	if !isStaffRole(c) {
		t.Error("delegated_admin in additional roles should be staff")
	}
}

func TestIsStaffRole_BursarDept(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "dept_bursar", Roles: ""})

	if !isStaffRole(c) {
		t.Error("dept_bursar should be staff")
	}
}

func TestIsStaffRole_NoClaims(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	if isStaffRole(c) {
		t.Error("no claims should not be staff")
	}
}

func TestIsStaffRole_NilClaimsType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", "not-a-claims-object")

	if isStaffRole(c) {
		t.Error("non-Claims value should not be staff")
	}
}

func TestGetUserID_FromString(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	id := uuid.New()
	c.Set("userID", id.String())

	got := getUserID(c)
	if got != id {
		t.Errorf("expected %s, got %s", id, got)
	}
}

func TestGetUserID_FromUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	id := uuid.New()
	c.Set("userID", id)

	got := getUserID(c)
	if got != id {
		t.Errorf("expected %s, got %s", id, got)
	}
}

func TestGetUserID_Missing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	got := getUserID(c)
	if got != uuid.Nil {
		t.Errorf("expected NilUUID, got %s", got)
	}
}
