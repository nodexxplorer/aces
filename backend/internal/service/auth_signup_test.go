package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// signupStore implements only the calls a sign-up makes. The embedded
// interface is nil, so any other call panics and the test fails loudly.
type signupStore struct {
	db.Querier

	emailTaken       bool
	matricTaken      bool
	createUserErr    error
	createStudentErr error
	createStaffErr   error

	lastUser     uuid.UUID
	createdUsers int
	deleted      []uuid.UUID
}

func (f *signupStore) GetUserByEmail(_ context.Context, email string) (db.User, error) {
	if f.emailTaken {
		return db.User{Email: email}, nil
	}
	return db.User{}, pgx.ErrNoRows
}

func (f *signupStore) GetStudentByMatric(_ context.Context, _ *string) (db.Student, error) {
	if f.matricTaken {
		return db.Student{}, nil
	}
	return db.Student{}, pgx.ErrNoRows
}

func (f *signupStore) CreateUser(_ context.Context, arg db.CreateUserParams) (db.User, error) {
	f.createdUsers++
	if f.createUserErr != nil {
		return db.User{}, f.createUserErr
	}
	f.lastUser = uuid.New()
	return db.User{ID: f.lastUser, Email: arg.Email, Role: arg.Role}, nil
}

func (f *signupStore) CreateStudent(_ context.Context, arg db.CreateStudentParams) (db.Student, error) {
	if f.createStudentErr != nil {
		return db.Student{}, f.createStudentErr
	}
	return db.Student{UserID: arg.UserID, MatricNumber: arg.MatricNumber}, nil
}

func (f *signupStore) CreateStaff(_ context.Context, arg db.CreateStaffParams) (db.Staff, error) {
	if f.createStaffErr != nil {
		return db.Staff{}, f.createStaffErr
	}
	return db.Staff{UserID: arg.UserID}, nil
}

func (f *signupStore) CreateSignupApproval(_ context.Context, _ db.CreateSignupApprovalParams) (db.SignupApproval, error) {
	return db.SignupApproval{}, nil
}

func (f *signupStore) DeleteUser(_ context.Context, id uuid.UUID) error {
	f.deleted = append(f.deleted, id)
	return nil
}

func uniqueViolation(constraint string) error {
	return &pgconn.PgError{Code: "23505", ConstraintName: constraint}
}

func signUpStudent(t *testing.T, store *signupStore) error {
	t.Helper()
	_, err := NewAuthService(store).StudentSignup(context.Background(),
		"ada@example.com", "secret-pass", "Ada", "Lovelace", "", "EG/CE/2026/001", 100)
	return err
}

func TestStudentSignupRefusesTakenMatricBeforeWriting(t *testing.T) {
	store := &signupStore{matricTaken: true}
	err := signUpStudent(t, store)
	if !errors.Is(err, ErrMatricTaken) {
		t.Fatalf("got %v, want ErrMatricTaken", err)
	}
	if store.createdUsers != 0 {
		t.Fatalf("a user row was written for a taken matric (%d rows)", store.createdUsers)
	}
}

func TestStudentSignupRefusesTakenEmailBeforeWriting(t *testing.T) {
	store := &signupStore{emailTaken: true}
	if err := signUpStudent(t, store); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("got %v, want ErrEmailTaken", err)
	}
	if store.createdUsers != 0 {
		t.Fatalf("a user row was written for a taken email")
	}
}

func TestStudentSignupMatricRaceIsConflictAndLeavesNoUser(t *testing.T) {
	// A parallel request took the matric after the pre-check passed.
	store := &signupStore{createStudentErr: uniqueViolation("students_tenant_id_matric_number_key")}
	err := signUpStudent(t, store)
	if !errors.Is(err, ErrMatricTaken) {
		t.Fatalf("got %v, want ErrMatricTaken", err)
	}
	if len(store.deleted) != 1 || store.deleted[0] != store.lastUser {
		t.Fatalf("the orphan user was not removed: deleted=%v created=%v", store.deleted, store.lastUser)
	}
}

func TestStudentSignupOtherFailureIsNotAConflict(t *testing.T) {
	store := &signupStore{createStudentErr: errors.New("connection reset")}
	err := signUpStudent(t, store)
	if err == nil || errors.Is(err, ErrMatricTaken) || errors.Is(err, ErrEmailTaken) {
		t.Fatalf("got %v, want a plain failure", err)
	}
	if !strings.Contains(err.Error(), "failed to create student record") {
		t.Fatalf("unexpected message: %v", err)
	}
	if len(store.deleted) != 1 {
		t.Fatalf("the orphan user was not removed")
	}
}

func TestLecturerSignupEmailRaceIsConflict(t *testing.T) {
	store := &signupStore{createUserErr: uniqueViolation("users_tenant_id_email_key")}
	_, err := NewAuthService(store).LecturerSignup(context.Background(),
		"lec@example.com", "secret-pass", "Ada", "Lovelace", "", "STAFF-1", "Computer", "")
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("got %v, want ErrEmailTaken", err)
	}
}

func TestIsUniqueViolation(t *testing.T) {
	if !isUniqueViolation(fmt.Errorf("create student: %w", uniqueViolation("x"))) {
		t.Fatal("a wrapped 23505 must count as a unique violation")
	}
	if isUniqueViolation(&pgconn.PgError{Code: "23503"}) {
		t.Fatal("a foreign-key violation is not a unique violation")
	}
	if isUniqueViolation(errors.New("boom")) {
		t.Fatal("a plain error is not a unique violation")
	}
}
