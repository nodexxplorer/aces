package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
)

// TestDepartmentStampConfigUsesTheBoundDepartment: a CRF form signed in a
// department is stamped with that department's name, not another's.
func TestDepartmentStampConfigUsesTheBoundDepartment(t *testing.T) {
	ctx := tenant.With(context.Background(), tenant.Tenant{Name: "Department of Electrical Engineering"})
	cfg, err := departmentStampConfig(ctx)
	if err != nil {
		t.Fatalf("departmentStampConfig: %v", err)
	}
	if cfg.CompanyName != "DEPARTMENT OF ELECTRICAL ENGINEERING" {
		t.Errorf("CompanyName = %q, want the bound department's name", cfg.CompanyName)
	}
}

// TestDepartmentStampConfigRefusesWithoutADepartment: no bound department, or a
// blank one, means no stamp.
func TestDepartmentStampConfigRefusesWithoutADepartment(t *testing.T) {
	if _, err := departmentStampConfig(context.Background()); err == nil {
		t.Error("expected a refusal when no department is bound")
	}
	ctx := tenant.With(context.Background(), tenant.Tenant{Name: "   "})
	if _, err := departmentStampConfig(ctx); err == nil {
		t.Error("expected a refusal when the department has no name")
	}
}

// TestDepartmentStampConfigReadsTheTenantThroughGin: the preview and approve
// handlers pass the *gin.Context itself, so the department must be readable
// through it, as the database calls in the same handlers already rely on.
func TestDepartmentStampConfigReadsTheTenantThroughGin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := newEngine()
	engine.Use(func(c *gin.Context) {
		c.Request = c.Request.WithContext(tenant.With(c.Request.Context(),
			tenant.Tenant{Name: "Department of Petroleum Engineering"}))
		c.Next()
	})
	var got string
	var gotErr error
	engine.GET("/stamp", func(c *gin.Context) {
		cfg, err := departmentStampConfig(c)
		got, gotErr = cfg.CompanyName, err
		c.Status(http.StatusNoContent)
	})
	engine.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/stamp", nil))

	if gotErr != nil {
		t.Fatalf("departmentStampConfig through gin: %v", gotErr)
	}
	if got != "DEPARTMENT OF PETROLEUM ENGINEERING" {
		t.Errorf("CompanyName = %q through gin, want the bound department's name", got)
	}
}
