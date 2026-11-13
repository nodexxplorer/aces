package api

import (
	"errors"
	"github.com/aces/backend/internal/attendance"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"net/http/httptest"
	"testing"
)

func TestVerifiedAttendanceErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		err    error
		status int
	}{{attendance.ErrInvalid, 400}, {attendance.ErrForbidden, 403}, {attendance.ErrConflict, 409}, {attendance.ErrChallenge, 400}, {attendance.ErrLimit, 429}, {&pgconn.PgError{Code: "23505"}, 409}, {errors.New("database secret"), 500}} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		attendanceResponse(c, nil, tc.err)
		if w.Code != tc.status {
			t.Fatalf("%v: got %d", tc.err, w.Code)
		}
		if tc.status == 500 && w.Body.String() == tc.err.Error() {
			t.Fatal("database error leaked")
		}
	}
}
