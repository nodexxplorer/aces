package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/aces/backend/internal/service"
)

func wallpaperRouter(t *testing.T, key string) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	s := &Server{wallpapers: service.NewWallpaperService(key, "gemini-test-image")}
	r.POST("/wallpapers/generate", s.generateWallpaper)
	return r
}

func postPrompt(r *gin.Engine, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/wallpapers/generate", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestGenerateWallpaperValidatesThePrompt(t *testing.T) {
	r := wallpaperRouter(t, "test-key")

	if w := postPrompt(r, `{"prompt":"   "}`); w.Code != http.StatusBadRequest {
		t.Fatalf("blank prompt: %d", w.Code)
	}
	if w := postPrompt(r, `not json`); w.Code != http.StatusBadRequest {
		t.Fatalf("bad body: %d", w.Code)
	}
	long, _ := json.Marshal(map[string]string{"prompt": strings.Repeat("a", maxWallpaperPrompt+1)})
	if w := postPrompt(r, string(long)); w.Code != http.StatusBadRequest {
		t.Fatalf("long prompt: %d", w.Code)
	}
}

func TestGenerateWallpaperSaysWhenNotConfigured(t *testing.T) {
	r := wallpaperRouter(t, "")
	w := postPrompt(r, `{"prompt":"a lake"}`)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "not set up") {
		t.Fatalf("body = %s", w.Body.String())
	}
}
