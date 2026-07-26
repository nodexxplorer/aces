package service

import (
	"context"
	"log"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/ws"
	"github.com/google/uuid"
)

type NotificationServiceFull struct {
	queries *db.Queries
	wsHub   *ws.Hub
}

func NewNotificationServiceFull(queries *db.Queries, wsHub *ws.Hub) *NotificationServiceFull {
	return &NotificationServiceFull{
		queries: queries,
		wsHub:   wsHub,
	}
}

func (s *NotificationServiceFull) CreateAndPush(
	ctx context.Context,
	userID uuid.UUID,
	notifType, category, priority, title, message, actionURL, actionLabel string,
	senderID *uuid.UUID, entityType *string, entityID *uuid.UUID,
	metadata map[string]interface{},
) (db.NotificationFull, error) {
	notif, err := s.queries.CreateNotificationFull(ctx, db.CreateNotificationFullParams{
		UserID:      userID,
		Type:        notifType,
		Title:       title,
		Message:     message,
		Category:    category,
		Priority:    priority,
		SenderID:    senderID,
		EntityType:  entityType,
		EntityID:    entityID,
		ActionLabel: &actionLabel,
		Metadata:    metadata,
	})
	if err != nil {
		return db.NotificationFull{}, err
	}

	if actionURL != "" {
		notif.ActionUrl = &actionURL
	}
	if actionLabel != "" {
		notif.ActionLabel = &actionLabel
	}

	if s.wsHub != nil {
		s.wsHub.SendToUser(userID, ws.TypeNotification, notif)
	}

	return notif, nil
}

func (s *NotificationServiceFull) List(ctx context.Context, userID uuid.UUID, category, status string, limit, offset int32) ([]db.NotificationFull, error) {
	return s.queries.ListUserNotificationsFull(ctx, userID, category, status, limit, offset)
}

func (s *NotificationServiceFull) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.queries.CountUnreadNotifications(ctx, userID)
}

func (s *NotificationServiceFull) GetUnreadByCategory(ctx context.Context, userID uuid.UUID) ([]db.CategoryCount, error) {
	return s.queries.CountUnreadByCategory(ctx, userID)
}

func (s *NotificationServiceFull) MarkAsRead(ctx context.Context, id, userID uuid.UUID) (db.NotificationFull, error) {
	return s.queries.MarkNotificationAsReadFull(ctx, id, userID)
}

func (s *NotificationServiceFull) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	return s.queries.MarkAllNotificationsAsRead(ctx, userID)
}

func (s *NotificationServiceFull) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return s.queries.DeleteNotificationFull(ctx, id, userID)
}

func (s *NotificationServiceFull) GetPreferences(ctx context.Context, userID uuid.UUID) (db.NotificationPreference, error) {
	return s.queries.GetNotificationPreferences(ctx, userID)
}

func (s *NotificationServiceFull) UpdatePreferences(ctx context.Context, arg db.UpsertNotificationPreferencesParams) (db.NotificationPreference, error) {
	return s.queries.UpsertNotificationPreferences(ctx, arg)
}

// BroadcastNotification creates notifications for multiple users based on targeting criteria
// and pushes each via WebSocket. Returns the number of notifications created.
func (s *NotificationServiceFull) BroadcastNotification(
	ctx context.Context,
	title, message, category, priority string,
	targetAudience string,
	targetRoles []string,
	targetLevel int32,
	senderID *uuid.UUID,
) (int, error) {
	var userIDs []uuid.UUID
	var err error

	switch targetAudience {
	case "role":
		userIDs, err = s.queries.ListUsersByRole(ctx, targetRoles)
	case "level":
		userIDs, err = s.queries.ListStudentUserIDsByLevel(ctx, targetLevel)
	default:
		userIDs, err = s.queries.ListAllActiveUserIDs(ctx)
	}
	if err != nil {
		return 0, err
	}

	count := 0
	for _, uid := range userIDs {
		_, err := s.CreateAndPush(ctx, uid,
			string(db.NotificationTypeGeneral),
			category,
			priority,
			title,
			message,
			"",
			"",
			senderID,
			nil,
			nil,
			nil,
		)
		if err != nil {
			log.Printf("[notification] broadcast to user %s failed: %v", uid, err)
			continue
		}
		count++
	}

	return count, nil
}
