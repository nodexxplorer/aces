package service

import (
	"context"
	"errors"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/util"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type AuthService struct {
	store db.Querier
}

func NewAuthService(store db.Querier) *AuthService {
	return &AuthService{store: store}
}

// Sign-up conflicts. The API answers them with 409 and shows the message as
// it is, so the wording is for the person signing up.
var (
	ErrEmailTaken  = errors.New("an account with this email is already registered in this department")
	ErrMatricTaken = errors.New("this matric number is already registered in this department. If it is yours, sign in instead")
)

// isUniqueViolation reports whether err is a PostgreSQL unique-constraint
// violation (SQLSTATE 23505). A parallel sign-up can win the race that the
// pre-checks below lost, and the database is the final judge.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// discardUser removes the user row a sign-up created before a later step
// failed, so a retry is not blocked by a half-made account. The student and
// staff rows cascade with it. The caller is already returning the real
// failure, so a failure here is ignored.
func (s *AuthService) discardUser(ctx context.Context, id uuid.UUID) {
	_ = s.store.DeleteUser(ctx, id)
}

type SignupResult struct {
	User    db.User
	Student *db.Student
	Staff   *db.Staff
}

func (s *AuthService) StudentSignup(ctx context.Context, email, password, firstName, lastName, phone, matricNumber string, level int32) (*SignupResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	matric := strings.ToUpper(strings.TrimSpace(matricNumber))

	// The pre-checks run before anything is written, so a clash leaves no
	// partial account. The unique constraints still catch a clash that a
	// parallel request creates in between.
	if _, err := s.store.GetUserByEmail(ctx, email); err == nil {
		return nil, ErrEmailTaken
	}
	if _, err := s.store.GetStudentByMatric(ctx, &matric); err == nil {
		return nil, ErrMatricTaken
	}

	hashedPassword, err := util.HashPassword(password)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	var phonePtr *string
	if phone != "" {
		p := strings.TrimSpace(phone)
		phonePtr = &p
	}

	user, err := s.store.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: hashedPassword,
		Role:         db.UserRoleStudent,
		FirstName:    strings.TrimSpace(firstName),
		LastName:     strings.TrimSpace(lastName),
		Phone:        phonePtr,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailTaken
		}
		return nil, errors.New("failed to create user: " + err.Error())
	}

	// matric_number / entry_year became nullable (migration 000002: OAuth
	// students onboard later), so the generated params take pointers.
	entryYear := int32(time.Now().Year())
	student, err := s.store.CreateStudent(ctx, db.CreateStudentParams{
		UserID:       user.ID,
		MatricNumber: &matric,
		Level:        level,
		EntryYear:    &entryYear,
	})
	if err != nil {
		s.discardUser(ctx, user.ID)
		if isUniqueViolation(err) {
			return nil, ErrMatricTaken
		}
		return nil, errors.New("failed to create student record: " + err.Error())
	}

	levelVal := level
	_, err = s.store.CreateSignupApproval(ctx, db.CreateSignupApprovalParams{
		UserID:     user.ID,
		SignupType: "student",
		RegNo:      &matricNumber,
		Level:      &levelVal,
		Status:     "pending",
	})
	if err != nil {
		s.discardUser(ctx, user.ID)
		return nil, errors.New("failed to create approval request: " + err.Error())
	}

	return &SignupResult{User: user, Student: &student}, nil
}

func (s *AuthService) LecturerSignup(ctx context.Context, email, password, firstName, lastName, phone, staffId, department, specialization string) (*SignupResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	if _, err := s.store.GetUserByEmail(ctx, email); err == nil {
		return nil, ErrEmailTaken
	}

	hashedPassword, err := util.HashPassword(password)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	var phonePtr *string
	if phone != "" {
		p := strings.TrimSpace(phone)
		phonePtr = &p
	}

	user, err := s.store.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: hashedPassword,
		Role:         db.UserRoleLecturer,
		FirstName:    strings.TrimSpace(firstName),
		LastName:     strings.TrimSpace(lastName),
		Phone:        phonePtr,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailTaken
		}
		return nil, errors.New("failed to create user: " + err.Error())
	}

	var specPtr *string
	if specialization != "" {
		s := strings.TrimSpace(specialization)
		specPtr = &s
	}

	staff, err := s.store.CreateStaff(ctx, db.CreateStaffParams{
		UserID:         user.ID,
		StaffID:        strings.ToUpper(strings.TrimSpace(staffId)),
		Department:     strings.TrimSpace(department),
		Specialization: specPtr,
	})
	if err != nil {
		s.discardUser(ctx, user.ID)
		return nil, errors.New("failed to create staff record: " + err.Error())
	}

	_, err = s.store.CreateSignupApproval(ctx, db.CreateSignupApprovalParams{
		UserID:     user.ID,
		SignupType: "lecturer",
		RegNo:      &staffId,
		Status:     "pending",
	})
	if err != nil {
		s.discardUser(ctx, user.ID)
		return nil, errors.New("failed to create approval request: " + err.Error())
	}

	return &SignupResult{User: user, Staff: &staff}, nil
}

func (s *AuthService) Login(ctx context.Context, identifier, password string) (*db.User, bool, error) {
	identifier = strings.TrimSpace(identifier)
	user, err := s.store.GetUserByEmail(ctx, strings.ToLower(identifier))

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			matric := strings.ToUpper(identifier)
			student, errMatric := s.store.GetStudentByMatric(ctx, &matric)
			if errMatric == nil {
				user, err = s.store.GetUser(ctx, student.UserID)
			} else {
				staff, errStaff := s.store.GetStaffByStaffID(ctx, strings.ToUpper(identifier))
				if errStaff == nil {
					user, err = s.store.GetUser(ctx, staff.UserID)
				} else {
					return nil, false, errors.New("invalid email, matric number, staff ID or password")
				}
			}
		} else {
			return nil, false, err
		}
	}

	if err != nil {
		return nil, false, errors.New("invalid email, matric number, staff ID or password")
	}

	if !user.IsActive {
		return nil, false, errors.New("account is deactivated")
	}

	if err := util.CheckPassword(password, user.PasswordHash); err != nil {
		return nil, false, errors.New("invalid email, matric number, staff ID or password")
	}

	onboardingCompleted := true
	if user.Role == db.UserRoleStudent {
		student, err := s.store.GetStudentByUserId(ctx, user.ID)
		if err == nil {
			onboardingCompleted = student.OnboardingCompleted
		}
	}

	return &user, onboardingCompleted, nil
}

func (s *AuthService) GetUserByID(ctx context.Context, id uuid.UUID) (*db.User, error) {
	user, err := s.store.GetUser(ctx, id)
	if err != nil {
		return nil, errors.New("user not found")
	}
	return &user, nil
}

func (s *AuthService) IsOnboardingCompleted(ctx context.Context, user db.User) bool {
	if user.Role == db.UserRoleStudent {
		student, err := s.store.GetStudentByUserId(ctx, user.ID)
		if err == nil {
			return student.OnboardingCompleted
		}
	}
	return true
}

func (s *AuthService) RefreshToken(ctx context.Context, userID uuid.UUID) (*db.User, error) {
	user, err := s.store.GetUser(ctx, userID)
	if err != nil {
		return nil, errors.New("user not found")
	}
	return &user, nil
}
