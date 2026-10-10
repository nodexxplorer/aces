package api

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	db "github.com/aces/backend/internal/db/sql"
)

// The staff lockout. Students sign in with Modools, so the lockout covers the
// accounts that sign in with a password: lecturers, admins and bursars. After
// lockoutThreshold wrong passwords the account is locked for lockoutWindow, and
// a correct password before then clears the count. A lock never reveals the
// password, and the rate limiter on the login route still applies on top.
const (
	lockoutThreshold = 5
	lockoutWindow    = 30 * time.Minute
)

// staffRoleNames are the roles that sign in with a password. Any one of them
// makes the account a staff account for the lockout.
var staffRoleNames = map[string]bool{
	"lecturer":        true,
	"hod":             true,
	"delegated_admin": true,
	"admin":           true,
	"class_bursar":    true,
	"dept_bursar":     true,
	"bursar_class":    true,
	"bursar_dept":     true,
}

// staffAccountFor returns the account a sign-in names, when that account is a
// staff account. The identifier is an email or a staff ID. It returns nil for a
// student, an unknown identifier, or any lookup error, so nothing is locked by mistake.
func (server *Server) staffAccountFor(ctx *gin.Context, identifier string) *db.User {
	user, err := server.store.GetUserByEmail(ctx, strings.ToLower(identifier))
	if err != nil {
		staff, serr := server.store.GetStaffByStaffID(ctx, strings.ToUpper(identifier))
		if serr != nil {
			return nil
		}
		user, err = server.store.GetUser(ctx, staff.UserID)
		if err != nil {
			return nil
		}
	}
	roles, _ := server.roles.ListUserRolesByName(ctx, user.ID)
	if len(roles) == 0 {
		roles = []string{string(user.Role)}
	}
	for _, r := range roles {
		if staffRoleNames[r] {
			return &user
		}
	}
	return nil
}

// staffLockedUntil reports whether the account is locked now, and until when.
func (server *Server) staffLockedUntil(ctx *gin.Context, userID uuid.UUID) (time.Time, bool) {
	lock, err := server.store.GetLockoutStatusByUser(ctx, userID)
	if err != nil {
		return time.Time{}, false // no row: never failed, so not locked
	}
	if lock.IsLocked && lock.UnlockAt.Valid && lock.UnlockAt.Time.After(time.Now()) {
		return lock.UnlockAt.Time, true
	}
	return time.Time{}, false
}

// recordFailedStaffLogin counts one wrong password. On the lockoutThreshold-th
// failure the account is locked. A lock that has run out starts a fresh count.
func (server *Server) recordFailedStaffLogin(ctx *gin.Context, userID uuid.UUID, clientIP string) {
	// The unique index on user_id makes this a no-op when the row exists.
	_ = server.store.CreateLockoutIfNeeded(ctx, userID)

	if lock, err := server.store.GetLockoutStatusByUser(ctx, userID); err == nil &&
		lock.IsLocked && lock.UnlockAt.Valid && !lock.UnlockAt.Time.After(time.Now()) {
		_ = server.store.ResetLockout(ctx, userID)
	}

	_ = server.store.RecordFailedLogin(ctx, db.RecordFailedLoginParams{UserID: userID, Column2: clientIP})

	lock, err := server.store.GetLockoutStatusByUser(ctx, userID)
	if err != nil {
		return
	}
	if !lock.IsLocked && lock.FailedAttempts >= lockoutThreshold {
		_ = server.store.LockAccount(ctx, userID) // sets unlock_at to now + 30 minutes
	}
}

// clearStaffLockout ends a count after a correct password.
func (server *Server) clearStaffLockout(ctx *gin.Context, userID uuid.UUID) {
	_ = server.store.ResetLockout(ctx, userID)
}
