package middleware

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAttendanceLimitsSeparateAccountsOnCampusNAT(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(KeyedRateLimit(nil, "attendance", 1, time.Minute, func(c *gin.Context) string { return c.GetHeader("Test-User") }))
	r.GET("/check", func(c *gin.Context) { c.Status(200) })
	for _, tc := range []struct {
		user   string
		status int
	}{{"a", 200}, {"b", 200}, {"a", 429}, {"", 401}} {
		req := httptest.NewRequest(http.MethodGet, "/check", nil)
		req.Header.Set("Test-User", tc.user)
		req.RemoteAddr = "192.0.2.1:80"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tc.status {
			t.Fatalf("user %s: got %d want %d", tc.user, w.Code, tc.status)
		}
	}
}
