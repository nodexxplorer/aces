package service

import (
	"context"
	"errors"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/util"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type UserService struct {
	store db.Querier
}

func NewUserService(store db.Querier) *UserService {
	return &UserService{store: store}
}

type CreateUserInput struct {
	Email     string
	Password  string
	Role      string
	FullName  string
	Phone     *string
	AvatarURL *string
}

func (s *UserService) Create(ctx context.Context, input CreateUserInput) (db.User, error) {
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.FullName = strings.TrimSpace(input.FullName)
	if input.Phone != nil {
		sanitized := strings.TrimSpace(*input.Phone)
		input.Phone = &sanitized
	}

	hashedPassword, err := util.HashPassword(input.Password)
	if err != nil {
		return db.User{}, errors.New("failed to hash password")
	}

	user, err := s.store.CreateUser(ctx, db.CreateUserParams{
		Email:        input.Email,
		PasswordHash: hashedPassword,
		Role:         db.UserRole(input.Role),
		FullName:     input.FullName,
		Phone:        input.Phone,
		AvatarUrl:    input.AvatarURL,
	})
	if err != nil {
		return db.User{}, err
	}

	user.PasswordHash = ""
	return user, nil
}

func (s *UserService) GetByID(ctx context.Context, id uuid.UUID) (db.User, error) {
	user, err := s.store.GetUser(ctx, id)
	if err != nil {
		return db.User{}, err
	}
	user.PasswordHash = ""
	return user, nil
}

func (s *UserService) List(ctx context.Context, limit, offset int32) ([]db.User, error) {
	users, err := s.store.ListUsers(ctx, db.ListUsersParams{Limit: limit, Offset: offset})
	if err != nil {
		return nil, err
	}
	for i := range users {
		users[i].PasswordHash = ""
	}
	return users, nil
}

func (s *UserService) ListUsersWithStudents(ctx context.Context, limit, offset int32, role, search string) ([]db.UserWithStudent, error) {
	if q, ok := s.store.(*db.Queries); ok {
		return q.ListUsersWithStudents(ctx, limit, offset, role, search)
	}
	return nil, errors.New("store does not support ListUsersWithStudents")
}

func (s *UserService) Update(ctx context.Context, id uuid.UUID, fullName string, phone, avatarURL *string, isActive, emailVerified, twoFactorEnabled bool) (db.User, error) {
	arg := db.UpdateUserParams{
		ID:               id,
		FullName:         strings.TrimSpace(fullName),
		Phone:            phone,
		AvatarUrl:        avatarURL,
		IsActive:         isActive,
		EmailVerified:    emailVerified,
		TwoFactorEnabled: twoFactorEnabled,
	}

	if arg.Phone != nil {
		sanitized := strings.TrimSpace(*arg.Phone)
		arg.Phone = &sanitized
	}

	user, err := s.store.UpdateUser(ctx, arg)
	if err != nil {
		return db.User{}, err
	}
	user.PasswordHash = ""
	return user, nil
}

func (s *UserService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteUser(ctx, id)
}

type UpdateUserPartialInput struct {
	FullName  *string
	Phone     *string
	AvatarURL *string
	IsActive  *bool
	Email     *string
	Role      *string
}

func (s *UserService) UpdatePartial(ctx context.Context, id uuid.UUID, input UpdateUserPartialInput) (db.User, error) {
	existing, err := s.store.GetUser(ctx, id)
	if err != nil {
		return db.User{}, err
	}

	fullName := existing.FullName
	if input.FullName != nil {
		fullName = strings.TrimSpace(*input.FullName)
	}

	phone := existing.Phone
	if input.Phone != nil {
		sanitized := strings.TrimSpace(*input.Phone)
		phone = &sanitized
	}

	avatarURL := existing.AvatarUrl
	if input.AvatarURL != nil {
		avatarURL = input.AvatarURL
	}

	isActive := existing.IsActive
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	// First update core fields (name, phone, avatar, active)
	user, err := s.store.UpdateUser(ctx, db.UpdateUserParams{
		ID:               id,
		FullName:         fullName,
		Phone:            phone,
		AvatarUrl:        avatarURL,
		IsActive:         isActive,
		EmailVerified:    existing.EmailVerified,
		TwoFactorEnabled: existing.TwoFactorEnabled,
	})
	if err != nil {
		return db.User{}, err
	}

	// Update email and role if provided
	if input.Email != nil || input.Role != nil {
		email := string(user.Email)
		role := user.Role
		if input.Email != nil {
			email = strings.ToLower(strings.TrimSpace(*input.Email))
		}
		if input.Role != nil {
			role = db.UserRole(strings.TrimSpace(*input.Role))
		}
		user, err = s.store.(*db.Queries).UpdateUserEmailAndRole(ctx, id, email, role)
		if err != nil {
			return db.User{}, err
		}
	}

	user.PasswordHash = ""
	return user, nil
}

func (s *UserService) Approve(ctx context.Context, id uuid.UUID, approvedBy uuid.UUID) (db.User, error) {
	user, err := s.store.GetUser(ctx, id)
	if err != nil {
		return db.User{}, errors.New("user not found")
	}

	approval, err := s.store.GetSignupApprovalByUserId(ctx, user.ID)
	if err != nil {
		return db.User{}, errors.New("approval request not found")
	}

	_, err = s.store.UpdateSignupApproval(ctx, db.UpdateSignupApprovalParams{
		ID:        approval.ID,
		Status:    "approved",
		ApprovedBy: pgtype.UUID{Bytes: approvedBy, Valid: true},
	})
	if err != nil {
		return db.User{}, err
	}

	updatedUser, err := s.store.ApproveUserStatus(ctx, db.ApproveUserStatusParams{
		ID:        user.ID,
		IsApproved: true,
		ApprovedBy: pgtype.UUID{Bytes: approvedBy, Valid: true},
	})
	if err != nil {
		return db.User{}, err
	}
	updatedUser.PasswordHash = ""
	return updatedUser, nil
}

func (s *UserService) Reject(ctx context.Context, id uuid.UUID, reason string) error {
	user, err := s.store.GetUser(ctx, id)
	if err != nil {
		return errors.New("user not found")
	}

	approval, err := s.store.GetSignupApprovalByUserId(ctx, user.ID)
	if err != nil {
		return errors.New("approval request not found")
	}

	_, err = s.store.UpdateSignupApproval(ctx, db.UpdateSignupApprovalParams{
		ID:              approval.ID,
		Status:          "rejected",
		RejectionReason: &reason,
	})
	return err
}
