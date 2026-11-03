package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aces/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func TestVerifyInternalSecret(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		configured string
		headerKey  string
		headerVal  string
		want       bool
	}{
		{
			name:       "empty secret allows all",
			configured: "",
			headerKey:  "",
			headerVal:  "",
			want:       true,
		},
		{
			name:       "valid X-Internal-Secret",
			configured: "secret-123",
			headerKey:  "X-Internal-Secret",
			headerVal:  "secret-123",
			want:       true,
		},
		{
			name:       "invalid X-Internal-Secret",
			configured: "secret-123",
			headerKey:  "X-Internal-Secret",
			headerVal:  "wrong-secret",
			want:       false,
		},
		{
			name:       "missing secret when required",
			configured: "secret-123",
			headerKey:  "",
			headerVal:  "",
			want:       false,
		},
		{
			name:       "valid Bearer auth",
			configured: "secret-123",
			headerKey:  "Authorization",
			headerVal:  "Bearer secret-123",
			want:       true,
		},
		{
			name:       "invalid Bearer auth",
			configured: "secret-123",
			headerKey:  "Authorization",
			headerVal:  "Bearer wrong-secret",
			want:       false,
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
			c, _ := gin.CreateTestContext(w)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/internal/cron/all", nil)
			if tt.headerKey != "" {
				req.Header.Set(tt.headerKey, tt.headerVal)
			}
			c.Request = req

			got := s.verifyInternalSecret(c)
			if got != tt.want {
				t.Errorf("verifyInternalSecret() = %v, want %v", got, tt.want)
			}
		})
	}
}
