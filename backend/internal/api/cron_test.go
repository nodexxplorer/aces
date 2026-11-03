package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aces/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func TestRequireInternalCronAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		configured string
		headerKey  string
		headerVal  string
		wantStatus int
	}{
		{
			name:       "empty secret fails closed",
			configured: "",
			headerKey:  "",
			headerVal:  "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "valid X-Internal-Secret",
			configured: "secret-123",
			headerKey:  "X-Internal-Secret",
			headerVal:  "secret-123",
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid X-Internal-Secret",
			configured: "secret-123",
			headerKey:  "X-Internal-Secret",
			headerVal:  "wrong-secret",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "missing secret when required",
			configured: "secret-123",
			headerKey:  "",
			headerVal:  "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "valid Bearer auth",
			configured: "secret-123",
			headerKey:  "Authorization",
			headerVal:  "Bearer secret-123",
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid Bearer auth",
			configured: "secret-123",
			headerKey:  "Authorization",
			headerVal:  "Bearer wrong-secret",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Server{
				config: &config.Config{
					InternalCronSecret: tt.configured,
				},
			}

			w := httptest.NewRecorder()
			_, r := gin.CreateTestContext(w)
			r.POST("/cron", s.requireInternalCronAuth(), func(ctx *gin.Context) {
				ctx.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			req := httptest.NewRequest(http.MethodPost, "/cron", nil)
			if tt.headerKey != "" {
				req.Header.Set(tt.headerKey, tt.headerVal)
			}
			r.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}
