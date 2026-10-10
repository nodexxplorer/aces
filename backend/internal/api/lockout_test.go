package api

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
)

// lockStore is an in-memory stand-in for the few queries the lockout uses. Any
// other method panics, because the embedded interface is nil.
type lockStore struct {
	db.Querier
	users   map[uuid.UUID]db.User
	byEmail map[string]uuid.UUID
	roles   map[uuid.UUID][]db.UserRole
	locks   map[uuid.UUID]*db.AccountLockout
}

var errNoRow = errors.New("no rows")

func newLockStore() *lockStore {
	return &lockStore{
		users:   map[uuid.UUID]db.User{},
		byEmail: map[string]uuid.UUID{},
		roles:   map[uuid.UUID][]db.UserRole{},
		locks:   map[uuid.UUID]*db.AccountLockout{},
	}
}

func (s *lockStore) addUser(email string, role db.UserRole) uuid.UUID {
	id := uuid.New()
	s.users[id] = db.User{ID: id, Email: email, Role: role}
	s.byEmail[email] = id
	s.roles[id] = []db.UserRole{role}
	return id
}

func (s *lockStore) GetUserByEmail(_ context.Context, email string) (db.User, error) {
	id, ok := s.byEmail[email]
	if !ok {
		return db.User{}, errNoRow
	}
	return s.users[id], nil
}

func (s *lockStore) GetStaffByStaffID(_ context.Context, _ string) (db.Staff, error) {
	return db.Staff{}, errNoRow
}

func (s *lockStore) GetUser(_ context.Context, id uuid.UUID) (db.User, error) {
	u, ok := s.users[id]
	if !ok {
		return db.User{}, errNoRow
	}
	return u, nil
}

func (s *lockStore) ListUserRoles(_ context.Context, userID uuid.UUID) ([]db.UserRoleAssignment, error) {
	var out []db.UserRoleAssignment
	for _, r := range s.roles[userID] {
		out = append(out, db.UserRoleAssignment{UserID: userID, Role: r, IsActive: true})
	}
	return out, nil
}

func (s *lockStore) GetLockoutStatusByUser(_ context.Context, userID uuid.UUID) (db.AccountLockout, error) {
	l, ok := s.locks[userID]
	if !ok {
		return db.AccountLockout{}, errNoRow
	}
	return *l, nil
}

func (s *lockStore) CreateLockoutIfNeeded(_ context.Context, userID uuid.UUID) error {
	if _, ok := s.locks[userID]; !ok {
		s.locks[userID] = &db.AccountLockout{UserID: userID}
	}
	return nil
}

func (s *lockStore) RecordFailedLogin(_ context.Context, arg db.RecordFailedLoginParams) error {
	if l, ok := s.locks[arg.UserID]; ok {
		l.FailedAttempts++
	}
	return nil
}

func (s *lockStore) LockAccount(_ context.Context, userID uuid.UUID) error {
	if l, ok := s.locks[userID]; ok {
		l.IsLocked = true
		l.UnlockAt.Valid = true
		l.UnlockAt.Time = time.Now().Add(lockoutWindow)
	}
	return nil
}

func (s *lockStore) ResetLockout(_ context.Context, userID uuid.UUID) error {
	if l, ok := s.locks[userID]; ok {
		*l = db.AccountLockout{UserID: userID}
	}
	return nil
}

func lockServer(store *lockStore) *Server {
	return &Server{store: store, roles: service.NewRoleService(store)}
}

func lockContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/v1/auth/login", nil)
	return c
}

func failLogin(srv *Server, c *gin.Context, id uuid.UUID, times int) {
	for i := 0; i < times; i++ {
		srv.recordFailedStaffLogin(c, id, "203.0.113.7")
	}
}

func TestStaffAccountFor_OnlyStaffRolesCount(t *testing.T) {
	store := newLockStore()
	store.addUser("lecturer@example.com", db.UserRoleLecturer)
	store.addUser("admin@example.com", db.UserRoleAdmin)
	store.addUser("student@example.com", db.UserRoleStudent)
	srv := lockServer(store)
	c := lockContext()

	if srv.staffAccountFor(c, "lecturer@example.com") == nil {
		t.Error("a lecturer is staff for the lockout")
	}
	if srv.staffAccountFor(c, "admin@example.com") == nil {
		t.Error("an admin is staff for the lockout")
	}
	if srv.staffAccountFor(c, "student@example.com") != nil {
		t.Error("a student signs in with Modools, so is not locked here")
	}
	if srv.staffAccountFor(c, "nobody@example.com") != nil {
		t.Error("an unknown identifier locks nothing")
	}
}

func TestStaffLockout_LocksOnTheFifthWrongPassword(t *testing.T) {
	store := newLockStore()
	id := store.addUser("lecturer@example.com", db.UserRoleLecturer)
	srv := lockServer(store)
	c := lockContext()

	failLogin(srv, c, id, lockoutThreshold-1)
	if _, locked := srv.staffLockedUntil(c, id); locked {
		t.Fatalf("locked after %d wrong passwords; the limit is %d", lockoutThreshold-1, lockoutThreshold)
	}

	failLogin(srv, c, id, 1)
	until, locked := srv.staffLockedUntil(c, id)
	if !locked {
		t.Fatalf("not locked after %d wrong passwords", lockoutThreshold)
	}
	if d := time.Until(until); d < lockoutWindow-time.Minute || d > lockoutWindow+time.Minute {
		t.Errorf("lock runs for %v, want about %v", d, lockoutWindow)
	}
}

func TestStaffLockout_CorrectPasswordClearsTheCount(t *testing.T) {
	store := newLockStore()
	id := store.addUser("lecturer@example.com", db.UserRoleLecturer)
	srv := lockServer(store)
	c := lockContext()

	failLogin(srv, c, id, 3)
	srv.clearStaffLockout(c, id)
	failLogin(srv, c, id, 4)
	if _, locked := srv.staffLockedUntil(c, id); locked {
		t.Error("four failures after a successful sign-in should not lock; the count restarted")
	}
}

func TestStaffLockout_ExpiredLockStartsAFreshCount(t *testing.T) {
	store := newLockStore()
	id := store.addUser("lecturer@example.com", db.UserRoleLecturer)
	srv := lockServer(store)
	c := lockContext()

	failLogin(srv, c, id, lockoutThreshold)
	if _, locked := srv.staffLockedUntil(c, id); !locked {
		t.Fatal("setup: account should be locked")
	}

	// The lock runs out. One more wrong password is the first of a new count.
	store.locks[id].UnlockAt.Time = time.Now().Add(-time.Second)
	if _, locked := srv.staffLockedUntil(c, id); locked {
		t.Fatal("an expired lock should not count as locked")
	}
	failLogin(srv, c, id, 1)
	if _, locked := srv.staffLockedUntil(c, id); locked {
		t.Error("one failure after an expired lock should not lock the account again")
	}
}

func TestStaffLockout_StudentIsNeverCounted(t *testing.T) {
	store := newLockStore()
	store.addUser("student@example.com", db.UserRoleStudent)
	srv := lockServer(store)
	c := lockContext()

	if srv.staffAccountFor(c, "student@example.com") != nil {
		t.Fatal("setup: a student should not resolve to a staff account")
	}
	// Nothing is recorded for a student, so no lock row exists.
	if len(store.locks) != 0 {
		t.Errorf("lock rows created for a student: %d", len(store.locks))
	}
}
