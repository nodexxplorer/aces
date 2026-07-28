package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aces/backend/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// ─── isStaffCaller ──────────────────────────────────────────────────────────

func TestIsStaffCaller_Admin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "admin"})

	if !isStaffCaller(c) {
		t.Error("admin should be staff")
	}
}

func TestIsStaffCaller_Hod(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "hod"})

	if !isStaffCaller(c) {
		t.Error("hod should be staff")
	}
}

func TestIsStaffCaller_DelegatedAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "delegated_admin"})

	if !isStaffCaller(c) {
		t.Error("delegated_admin should be staff")
	}
}

func TestIsStaffCaller_DelegatedAdminViaAdditionalRoles(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "student", Roles: "delegated_admin"})

	if !isStaffCaller(c) {
		t.Error("delegated_admin in additional roles should be staff")
	}
}

func TestIsStaffCaller_Student(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "student"})

	if isStaffCaller(c) {
		t.Error("student should not be staff")
	}
}

func TestIsStaffCaller_Lecturer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "lecturer"})

	if isStaffCaller(c) {
		t.Error("lecturer should not be staff")
	}
}

func TestIsStaffCaller_ClassRep(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "class_rep"})

	if isStaffCaller(c) {
		t.Error("class_rep should not be staff")
	}
}

func TestIsStaffCaller_NoClaims(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	if isStaffCaller(c) {
		t.Error("no claims should not be staff")
	}
}

func TestIsStaffCaller_NilClaimsType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", "not-a-claims-object")

	if isStaffCaller(c) {
		t.Error("non-Claims value should not be staff")
	}
}

// ─── gradeFromScore ─────────────────────────────────────────────────────────

func TestGradeFromScore_A(t *testing.T) {
	tests := []struct {
		score  float64
		grade  string
		points float64
	}{
		{70, "A", 5.0},
		{75, "A", 5.0},
		{100, "A", 5.0},
		{92.5, "A", 5.0},
	}
	for _, tt := range tests {
		g, p := gradeFromScore(decimal.NewFromFloat(tt.score))
		if g != tt.grade || p != tt.points {
			t.Errorf("score %.1f: expected (%s, %.1f), got (%s, %.1f)", tt.score, tt.grade, tt.points, g, p)
		}
	}
}

func TestGradeFromScore_B(t *testing.T) {
	tests := []struct {
		score  float64
		grade  string
		points float64
	}{
		{60, "B", 4.0},
		{65, "B", 4.0},
		{69.99, "B", 4.0},
	}
	for _, tt := range tests {
		g, p := gradeFromScore(decimal.NewFromFloat(tt.score))
		if g != tt.grade || p != tt.points {
			t.Errorf("score %.1f: expected (%s, %.1f), got (%s, %.1f)", tt.score, tt.grade, tt.points, g, p)
		}
	}
}

func TestGradeFromScore_C(t *testing.T) {
	tests := []struct {
		score  float64
		grade  string
		points float64
	}{
		{50, "C", 3.0},
		{55, "C", 3.0},
		{59.99, "C", 3.0},
	}
	for _, tt := range tests {
		g, p := gradeFromScore(decimal.NewFromFloat(tt.score))
		if g != tt.grade || p != tt.points {
			t.Errorf("score %.1f: expected (%s, %.1f), got (%s, %.1f)", tt.score, tt.grade, tt.points, g, p)
		}
	}
}

func TestGradeFromScore_D(t *testing.T) {
	tests := []struct {
		score  float64
		grade  string
		points float64
	}{
		{45, "D", 2.0},
		{47, "D", 2.0},
		{49.99, "D", 2.0},
	}
	for _, tt := range tests {
		g, p := gradeFromScore(decimal.NewFromFloat(tt.score))
		if g != tt.grade || p != tt.points {
			t.Errorf("score %.1f: expected (%s, %.1f), got (%s, %.1f)", tt.score, tt.grade, tt.points, g, p)
		}
	}
}

func TestGradeFromScore_E(t *testing.T) {
	tests := []struct {
		score  float64
		grade  string
		points float64
	}{
		{40, "E", 1.0},
		{42, "E", 1.0},
		{44.99, "E", 1.0},
	}
	for _, tt := range tests {
		g, p := gradeFromScore(decimal.NewFromFloat(tt.score))
		if g != tt.grade || p != tt.points {
			t.Errorf("score %.1f: expected (%s, %.1f), got (%s, %.1f)", tt.score, tt.grade, tt.points, g, p)
		}
	}
}

func TestGradeFromScore_F(t *testing.T) {
	tests := []struct {
		score  float64
		grade  string
		points float64
	}{
		{0, "F", 0.0},
		{20, "F", 0.0},
		{39.99, "F", 0.0},
	}
	for _, tt := range tests {
		g, p := gradeFromScore(decimal.NewFromFloat(tt.score))
		if g != tt.grade || p != tt.points {
			t.Errorf("score %.1f: expected (%s, %.1f), got (%s, %.1f)", tt.score, tt.grade, tt.points, g, p)
		}
	}
}

func TestGradeFromScore_BoundaryValues(t *testing.T) {
	// Exact boundaries
	boundaries := []struct {
		score  float64
		grade  string
		points float64
	}{
		{0, "F", 0.0},
		{39.99, "F", 0.0},
		{40, "E", 1.0},
		{44.99, "E", 1.0},
		{45, "D", 2.0},
		{49.99, "D", 2.0},
		{50, "C", 3.0},
		{59.99, "C", 3.0},
		{60, "B", 4.0},
		{69.99, "B", 4.0},
		{70, "A", 5.0},
	}
	for _, tt := range boundaries {
		g, p := gradeFromScore(decimal.NewFromFloat(tt.score))
		if g != tt.grade || p != tt.points {
			t.Errorf("score %.2f: expected (%s, %.1f), got (%s, %.1f)", tt.score, tt.grade, tt.points, g, p)
		}
	}
}

// ─── getUserID ──────────────────────────────────────────────────────────────

func TestGetUserID_BursarDept(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "bursar_dept"})

	// bursar_dept is NOT staff for the new isStaffCaller
	if isStaffCaller(c) {
		t.Error("bursar_dept should not be staff")
	}
}

func TestGetUserID_BursarClass(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "bursar_class"})

	if isStaffCaller(c) {
		t.Error("bursar_class should not be staff")
	}
}

// ─── ownership check integration ────────────────────────────────────────────

func TestRequireOwnershipOrStaff_StaffCallerBypassesOwnership(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "admin"})
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	// Staff caller should always pass, regardless of recordStudentID
	recordStudentID := uuid.New()
	result := requireOwnershipOrStaff(c, nil, recordStudentID)
	if !result {
		t.Error("staff caller should bypass ownership check")
	}
}

func TestRequireOwnershipOrStaff_StudentNoUserIDFails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("claims", &auth.Claims{Role: "student"})
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	// Student with no userID set should fail
	recordStudentID := uuid.New()
	result := requireOwnershipOrStaff(c, nil, recordStudentID)
	if result {
		t.Error("student without userID should fail ownership check")
	}

	// Should have written 403
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}
