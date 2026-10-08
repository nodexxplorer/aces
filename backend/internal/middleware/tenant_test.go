package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aces/backend/internal/auth"
	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const tenantTestSecret = "test-secret-key-must-be-at-least-32-chars!!"

type fakeResolver map[uuid.UUID]tenant.Tenant

func (f fakeResolver) ByID(_ context.Context, id uuid.UUID) (tenant.Tenant, error) {
	t, ok := f[id]
	if !ok {
		return tenant.Tenant{}, tenant.ErrNotFound
	}
	return t, nil
}

var (
	deptA = tenant.Tenant{ID: uuid.MustParse("33333333-3333-4333-8333-333333333333"), Slug: "dept-a", IsActive: true}
	deptB = tenant.Tenant{ID: uuid.MustParse("44444444-4444-4444-8444-444444444444"), Slug: "dept-b", IsActive: false}
)

func tenantTestRouter(tm *auth.TokenManager, res TenantResolver) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(JWTAuth(tm))
	r.Use(TenantScope(res))
	r.GET("/whoami", func(c *gin.Context) {
		t, ok := tenant.From(c.Request.Context())
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no tenant bound"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"tenant_id": t.ID.String(), "slug": t.Slug})
	})
	return r
}

func doWhoami(r *gin.Engine, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// legacyToken signs an access token the way the server did before tenants
// existed: no tenant_id and no tenant_slug claim.
func legacyToken(t *testing.T) string {
	t.Helper()
	claims := &auth.Claims{
		UserID: uuid.New().String(),
		Role:   "student",
		Email:  "legacy@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			Issuer:    "aces-zone",
		},
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(tenantTestSecret))
	if err != nil {
		t.Fatalf("sign legacy token: %v", err)
	}
	return signed
}

func TestTenantScopeBindsTokenTenant(t *testing.T) {
	tm := auth.NewTokenManager(tenantTestSecret, time.Hour, time.Hour)
	res := fakeResolver{deptA.ID: deptA}

	pair, err := tm.GeneratePair(uuid.New(), auth.Tenant{ID: deptA.ID, Slug: deptA.Slug}, "student", "a@example.com", []string{"student"})
	if err != nil {
		t.Fatal(err)
	}

	w := doWhoami(tenantTestRouter(tm, res), pair.AccessToken)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	var body map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["tenant_id"] != deptA.ID.String() || body["slug"] != "dept-a" {
		t.Fatalf("bound tenant = %v, want dept-a (%s)", body, deptA.ID)
	}
}

func TestTenantScopeLegacyTokenUsesLegacyTenant(t *testing.T) {
	tm := auth.NewTokenManager(tenantTestSecret, time.Hour, time.Hour)
	res := fakeResolver{tenant.LegacyID: {ID: tenant.LegacyID, Slug: "uniuyo-ce", IsActive: true}}

	w := doWhoami(tenantTestRouter(tm, res), legacyToken(t))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	var body map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["tenant_id"] != tenant.LegacyID.String() {
		t.Fatalf("legacy token bound to %v, want legacy tenant %s", body["tenant_id"], tenant.LegacyID)
	}
}

func TestTenantScopeRejectsInactiveTenant(t *testing.T) {
	tm := auth.NewTokenManager(tenantTestSecret, time.Hour, time.Hour)
	res := fakeResolver{deptB.ID: deptB}

	pair, err := tm.GeneratePair(uuid.New(), auth.Tenant{ID: deptB.ID, Slug: deptB.Slug}, "student", "b@example.com", []string{"student"})
	if err != nil {
		t.Fatal(err)
	}

	if w := doWhoami(tenantTestRouter(tm, res), pair.AccessToken); w.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 for an inactive tenant", w.Code)
	}
}

func TestTenantScopeRejectsUnknownOrMalformedTenant(t *testing.T) {
	tm := auth.NewTokenManager(tenantTestSecret, time.Hour, time.Hour)
	res := fakeResolver{deptA.ID: deptA}
	router := tenantTestRouter(tm, res)

	unknown, err := tm.GeneratePair(uuid.New(), auth.Tenant{ID: uuid.New(), Slug: "gone"}, "student", "u@example.com", []string{"student"})
	if err != nil {
		t.Fatal(err)
	}
	if w := doWhoami(router, unknown.AccessToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("unknown tenant: status = %d, want 401", w.Code)
	}

	// The zero UUID is a valid-looking string but never names a tenant.
	nilTenant, err := tm.GeneratePair(uuid.New(), auth.Tenant{}, "student", "n@example.com", []string{"student"})
	if err != nil {
		t.Fatal(err)
	}
	if w := doWhoami(router, nilTenant.AccessToken); w.Code != http.StatusUnauthorized {
		t.Fatalf("nil tenant: status = %d, want 401", w.Code)
	}
}
