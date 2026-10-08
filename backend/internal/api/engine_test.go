package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// bindLikeHandler binds a department the way bindTenant does: by replacing
// the request context. It then passes the gin context itself to a helper that
// reads the department from a plain context.Context, as database calls do.
func bindLikeHandler(want uuid.UUID) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request = c.Request.WithContext(tenant.With(c.Request.Context(), tenant.Tenant{ID: want, Slug: "dept-a", IsActive: true}))
		if got, ok := tenant.IDFrom(c); !ok || got != want {
			c.String(http.StatusInternalServerError, "department lost")
			return
		}
		c.String(http.StatusOK, "ok")
	}
}

func TestEngineForwardsBoundTenantToHandlers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	want := uuid.New()

	engine := newEngine()
	engine.GET("/probe", bindLikeHandler(want))

	w := httptest.NewRecorder()
	engine.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/probe", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status %d (%s); the API engine must forward the bound department to *gin.Context", w.Code, w.Body.String())
	}
}

// Documents the failure the engine setting prevents: a plain gin engine does
// not forward the request context, so the bound department is lost.
func TestPlainEngineLosesBoundTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)
	want := uuid.New()

	engine := gin.New()
	engine.GET("/probe", bindLikeHandler(want))

	w := httptest.NewRecorder()
	engine.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/probe", nil))
	if w.Code == http.StatusOK {
		t.Fatal("a plain gin engine kept the bound department; newEngine's fallback may no longer be needed, so review it")
	}
}
