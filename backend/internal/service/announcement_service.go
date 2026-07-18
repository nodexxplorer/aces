package service

import (
	"context"
	"encoding/json"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type AnnouncementService struct {
	store db.Querier
}

func NewAnnouncementService(store db.Querier) *AnnouncementService {
	return &AnnouncementService{store: store}
}

type CreateAnnouncementInput struct {
	Title          string
	Content        string
	IsPinned       bool
	TargetLevel    *int32
	TargetAudience []string
	ExpiresAt      string
	CreatedBy      uuid.UUID
}

func (s *AnnouncementService) Create(ctx context.Context, input CreateAnnouncementInput) (db.Announcement, error) {
	arg := db.CreateAnnouncementParams{
		Title:       input.Title,
		Content:     input.Content,
		IsPinned:    input.IsPinned,
		TargetLevel: input.TargetLevel,
		CreatedBy:   input.CreatedBy,
	}

	if input.TargetAudience != nil {
		audienceJSON, err := json.Marshal(input.TargetAudience)
		if err != nil {
			return db.Announcement{}, err
		}
		arg.TargetAudience = audienceJSON
	}

	if input.ExpiresAt != "" {
		expiresAt, err := time.Parse(time.RFC3339, input.ExpiresAt)
		if err != nil {
			return db.Announcement{}, err
		}
		arg.ExpiresAt = pgtype.Timestamptz{Time: expiresAt, Valid: true}
	}

	return s.store.CreateAnnouncement(ctx, arg)
}

func (s *AnnouncementService) GetByID(ctx context.Context, id uuid.UUID) (db.Announcement, error) {
	return s.store.GetAnnouncement(ctx, id)
}

func (s *AnnouncementService) ListActive(ctx context.Context, limit, offset int32) ([]db.Announcement, error) {
	return s.store.ListActiveAnnouncements(ctx, db.ListActiveAnnouncementsParams{
		Limit:  limit,
		Offset: offset,
	})
}

type UpdateAnnouncementInput struct {
	Title          string
	Content        string
	IsPinned       bool
	TargetLevel    *int32
	TargetAudience []string
	ExpiresAt      string
}

func (s *AnnouncementService) Update(ctx context.Context, id uuid.UUID, input UpdateAnnouncementInput) (db.Announcement, error) {
	arg := db.UpdateAnnouncementParams{
		ID:          id,
		Title:       input.Title,
		Content:     input.Content,
		IsPinned:    input.IsPinned,
		TargetLevel: input.TargetLevel,
	}

	if input.TargetAudience != nil {
		audienceJSON, err := json.Marshal(input.TargetAudience)
		if err != nil {
			return db.Announcement{}, err
		}
		arg.TargetAudience = audienceJSON
	}

	if input.ExpiresAt != "" {
		expiresAt, err := time.Parse(time.RFC3339, input.ExpiresAt)
		if err != nil {
			return db.Announcement{}, err
		}
		arg.ExpiresAt = pgtype.Timestamptz{Time: expiresAt, Valid: true}
	}

	return s.store.UpdateAnnouncement(ctx, arg)
}

func (s *AnnouncementService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteAnnouncement(ctx, id)
}

type NotificationService struct {
	store db.Querier
}

func NewNotificationService(store db.Querier) *NotificationService {
	return &NotificationService{store: store}
}

type CreateNotificationInput struct {
	UserID    uuid.UUID
	Type      string
	Title     string
	Message   string
	ActionURL string
	EmailSent bool
}

func (s *NotificationService) Create(ctx context.Context, input CreateNotificationInput) (db.Notification, error) {
	arg := db.CreateNotificationParams{
		UserID:    input.UserID,
		Type:      db.NotificationType(input.Type),
		Title:     input.Title,
		Message:   input.Message,
		EmailSent: input.EmailSent,
	}

	if input.ActionURL != "" {
		arg.ActionUrl = &input.ActionURL
	}

	return s.store.CreateNotification(ctx, arg)
}

func (s *NotificationService) ListByUser(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]db.Notification, error) {
	return s.store.ListUserNotifications(ctx, db.ListUserNotificationsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
}

func (s *NotificationService) MarkAsRead(ctx context.Context, id, userID uuid.UUID) (db.Notification, error) {
	return s.store.MarkNotificationAsRead(ctx, db.MarkNotificationAsReadParams{
		ID:     id,
		UserID: userID,
	})
}

func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	return s.store.MarkAllUserNotificationsAsRead(ctx, userID)
}

func (s *NotificationService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return s.store.DeleteNotification(ctx, db.DeleteNotificationParams{
		ID:     id,
		UserID: userID,
	})
}
