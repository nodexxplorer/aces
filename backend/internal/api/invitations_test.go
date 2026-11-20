package api

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aces/backend/internal/invitation"
	"github.com/gin-gonic/gin"
)

func TestInvitationErrorStatuses(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		err    error
		status int
	}{
		{invitation.ErrInvalid, 400}, {invitation.ErrForbidden, 403}, {invitation.ErrConflict, 409},
		{invitation.ErrRateLimit, 429}, {invitation.ErrSignIn, 401}, {errors.New("database unavailable"), 500},
	} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		invitationError(c, tc.err)
		if w.Code != tc.status {
			t.Fatalf("%v: got %d want %d", tc.err, w.Code, tc.status)
		}
	}
}
func TestStudentMobileCannotAcceptStaffInvitations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := &Server{}
	engine := newEngine()
	engine.POST("/accept", server.acceptAccessInvitation)
	req := httptest.NewRequest(http.MethodPost, "/accept", nil)
	req.Header.Set("X-Client-Platform", "mobile")
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("got %d want 403", w.Code)
	}
}
