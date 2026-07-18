package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aces/backend/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func setupTestRouter(tm *auth.TokenManager, roles ...string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(JWTAuth(tm))
	router.Use(RequireRoles(roles...))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})
	return router
}

func TestJWTAuth_MissingToken(t *testing.T) {
	tm := auth.NewTokenManager("test-secret-key-must-be-at-least-32-chars!!", 60*time.Minute, 7*24*60*time.Minute)
	router := setupTestRouter(tm, "admin")

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestJWTAuth_InvalidToken(t *testing.T) {
	tm := auth.NewTokenManager("test-secret-key-must-be-at-least-32-chars!!", 60*time.Minute, 7*24*60*time.Minute)
	router := setupTestRouter(tm, "admin")

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestJWTAuth_ValidToken_WrongRole(t *testing.T) {
	tm := auth.NewTokenManager("test-secret-key-must-be-at-least-32-chars!!", 60*time.Minute, 7*24*60*time.Minute)
	router := setupTestRouter(tm, "admin")

	pair, err := tm.GeneratePair(uuid.New(), "student", "test@example.com", []string{"student"})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+pair.AccessToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestJWTAuth_ValidToken_CorrectRole(t *testing.T) {
	tm := auth.NewTokenManager("test-secret-key-must-be-at-least-32-chars!!", 60*time.Minute, 7*24*60*time.Minute)
	router := setupTestRouter(tm, "admin")

	pair, err := tm.GeneratePair(uuid.New(), "admin", "test@example.com", []string{"admin"})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+pair.AccessToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestJWTAuth_AdditionalRoles(t *testing.T) {
	tm := auth.NewTokenManager("test-secret-key-must-be-at-least-32-chars!!", 60*time.Minute, 7*24*60*time.Minute)
	router := setupTestRouter(tm, "admin", "delegated_admin")

	pair, err := tm.GeneratePair(uuid.New(), "student", "test@example.com", []string{"student", "delegated_admin"})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+pair.AccessToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 via additional role, got %d", w.Code)
	}
}

func TestJWTAuth_CookieToken(t *testing.T) {
	tm := auth.NewTokenManager("test-secret-key-must-be-at-least-32-chars!!", 60*time.Minute, 7*24*60*time.Minute)
	router := setupTestRouter(tm, "admin")

	pair, err := tm.GeneratePair(uuid.New(), "admin", "test@example.com", []string{"admin"})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("GET", "/test", nil)
	req.AddCookie(&http.Cookie{Name: "aces_access_token", Value: pair.AccessToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 with cookie auth, got %d", w.Code)
	}
}
