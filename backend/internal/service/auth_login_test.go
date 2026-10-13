package service

import (
	"context"
	"errors"
	"testing"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/jackc/pgx/v5"
)

// loginStore implements only what Login reads. The embedded interface
// panics if anything else is called, which keeps the test honest.
type loginStore struct {
	db.Querier
	userErr error
}

func (f *loginStore) GetUserByEmail(_ context.Context, _ string) (db.User, error) {
	return db.User{}, f.userErr
}

func (f *loginStore) GetStudentByMatric(_ context.Context, _ *string) (db.Student, error) {
	return db.Student{}, pgx.ErrNoRows
}

func (f *loginStore) GetStaffByStaffID(_ context.Context, _ string) (db.Staff, error) {
	return db.Staff{}, pgx.ErrNoRows
}

// A database that does not answer must not look like a wrong password, or
// the user is told their credentials are bad when the problem is the server.
func TestLoginReportsDatabaseFailureAsUnavailable(t *testing.T) {
	svc := NewAuthService(&loginStore{userErr: errors.New("max clients reached")})
	_, _, err := svc.Login(context.Background(), "admin@admin.com", "whatever")
	if !errors.Is(err, ErrSignInUnavailable) {
		t.Fatalf("expected ErrSignInUnavailable, got %v", err)
	}
}

// An unknown account is still a plain credentials failure.
func TestLoginUnknownAccountIsInvalidCredentials(t *testing.T) {
	svc := NewAuthService(&loginStore{userErr: pgx.ErrNoRows})
	_, _, err := svc.Login(context.Background(), "nobody@example.com", "whatever")
	if err == nil || errors.Is(err, ErrSignInUnavailable) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
}
