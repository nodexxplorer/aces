package service

import (
	"context"
	"errors"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/util"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type AuthService struct {
	store db.Querier
}

func NewAuthService(store db.Querier) *AuthService {
	return &AuthService{store: store}
}

type SignupResult struct {
	User    db.User
	Student *db.Student
	Staff   *db.Staff
}

func (s *AuthService) StudentSignup(ctx context.Context, email, password, firstName, lastName, phone, matricNumber string, level int32) (*SignupResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	fullName := strings.TrimSpace(firstName) + " " + strings.TrimSpace(lastName)

	if _, err := s.store.GetUserByEmail(ctx, email); err == nil {
		return nil, errors.New("a user with this email already exists")
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
		FullName:     fullName,
		Phone:        phonePtr,
	})
	if err != nil {
		return nil, errors.New("failed to create user: " + err.Error())
	}

	student, err := s.store.CreateStudent(ctx, db.CreateStudentParams{
		UserID:       user.ID,
		MatricNumber: strings.ToUpper(strings.TrimSpace(matricNumber)),
		Level:        level,
		EntryYear:    int32(2025),
	})
	if err != nil {
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
		return nil, errors.New("failed to create approval request: " + err.Error())
	}

	return &SignupResult{User: user, Student: &student}, nil
}

func (s *AuthService) LecturerSignup(ctx context.Context, email, password, firstName, lastName, phone, staffId, department, specialization string) (*SignupResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	fullName := strings.TrimSpace(firstName) + " " + strings.TrimSpace(lastName)

	if _, err := s.store.GetUserByEmail(ctx, email); err == nil {
		return nil, errors.New("a user with this email already exists")
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
		FullName:     fullName,
		Phone:        phonePtr,
	})
	if err != nil {
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
		return nil, errors.New("failed to create staff record: " + err.Error())
	}

	_, err = s.store.CreateSignupApproval(ctx, db.CreateSignupApprovalParams{
		UserID:     user.ID,
		SignupType: "lecturer",
		RegNo:      &staffId,
		Status:     "pending",
	})
	if err != nil {
		return nil, errors.New("failed to create approval request: " + err.Error())
	}

	return &SignupResult{User: user, Staff: &staff}, nil
}

func (s *AuthService) Login(ctx context.Context, identifier, password string) (*db.User, bool, error) {
	identifier = strings.TrimSpace(identifier)
	user, err := s.store.GetUserByEmail(ctx, strings.ToLower(identifier))

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			student, errMatric := s.store.GetStudentByMatric(ctx, strings.ToUpper(identifier))
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
