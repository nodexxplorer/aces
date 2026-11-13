package api

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─── Notifications (Enhanced) ────────────────────────────────────────────────

type createNotificationRequest struct {
	UserID      string `json:"user_id" binding:"required,uuid"`
	Type        string `json:"type" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Message     string `json:"message" binding:"required"`
	ActionURL   string `json:"action_url" binding:"omitempty"`
	ActionLabel string `json:"action_label" binding:"omitempty"`
	Category    string `json:"category" binding:"omitempty"`
	Priority    string `json:"priority" binding:"omitempty"`
	EmailSent   bool   `json:"email_sent"`
}

func (server *Server) createNotification(ctx *gin.Context) {
	var req createNotificationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID, _ := uuid.Parse(req.UserID)
	senderID := getUserID(ctx)

	notif, err := server.notificationsFull.CreateAndPush(ctx, userID,
		req.Type,
		req.Category,
		req.Priority,
		req.Title,
		req.Message,
		req.ActionURL,
		req.ActionLabel,
		&senderID,
		nil,
		nil,
		nil,
	)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, notif)
}

type listMyNotificationsRequest struct {
	Category string `form:"category" binding:"omitempty"`
	Status   string `form:"status" binding:"omitempty,oneof=unread read all"`
	Limit    int32  `form:"limit" binding:"required,min=1,max=100"`
	Offset   int32  `form:"offset" binding:"min=0"`
}

func (server *Server) listMyNotifications(ctx *gin.Context) {
	userID := getUserID(ctx)

	var req listMyNotificationsRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	notifications, err := server.notificationsFull.List(ctx, userID, req.Category, req.Status, req.Limit, req.Offset)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, notifications)
}

func (server *Server) getMyUnreadCount(ctx *gin.Context) {
	userID := getUserID(ctx)

	count, err := server.notificationsFull.GetUnreadCount(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"unread_count": count})
}

func (server *Server) getMyUnreadByCategory(ctx *gin.Context) {
	userID := getUserID(ctx)

	counts, err := server.notificationsFull.GetUnreadByCategory(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, counts)
}

func (server *Server) markNotificationAsRead(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification id"})
		return
	}

	userID := getUserID(ctx)

	notification, err := server.notificationsFull.MarkAsRead(ctx, id, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, notification)
}

func (server *Server) markAllAsRead(ctx *gin.Context) {
	userID := getUserID(ctx)

	if err := server.notificationsFull.MarkAllAsRead(ctx, userID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "all notifications marked as read"})
}

func (server *Server) deleteNotification(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification id"})
		return
	}

	userID := getUserID(ctx)

	if err := server.notificationsFull.Delete(ctx, id, userID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "notification deleted successfully"})
}

func (server *Server) getMyNotificationPreferences(ctx *gin.Context) {
	userID := getUserID(ctx)

	prefs, err := server.notificationsFull.GetPreferences(ctx, userID)
	if err != nil {
		// Auto-create default preferences if none exist
		prefs, err = server.notificationsFull.UpdatePreferences(ctx, db.UpsertNotificationPreferencesParams{
			UserID: userID,
		})
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	}

	ctx.JSON(http.StatusOK, prefs)
}

type updateNotificationPreferencesRequest struct {
	EmailEnabled    *bool   `json:"email_enabled"`
	PushEnabled     *bool   `json:"push_enabled"`
	InAppEnabled    *bool   `json:"in_app_enabled"`
	EmailAuth       *bool   `json:"email_auth"`
	EmailResults    *bool   `json:"email_results"`
	EmailDues       *bool   `json:"email_dues"`
	EmailMessages   *bool   `json:"email_messages"`
	EmailConnect    *bool   `json:"email_connect"`
	EmailSkills     *bool   `json:"email_skills"`
	EmailAlumni     *bool   `json:"email_alumni"`
	EmailSystem     *bool   `json:"email_system"`
	PushAuth        *bool   `json:"push_auth"`
	PushResults     *bool   `json:"push_results"`
	PushDues        *bool   `json:"push_dues"`
	PushMessages    *bool   `json:"push_messages"`
	PushConnect     *bool   `json:"push_connect"`
	PushSkills      *bool   `json:"push_skills"`
	PushAlumni      *bool   `json:"push_alumni"`
	PushSystem      *bool   `json:"push_system"`
	QuietHoursStart *string `json:"quiet_hours_start"`
	QuietHoursEnd   *string `json:"quiet_hours_end"`
}

func (server *Server) updateMyNotificationPreferences(ctx *gin.Context) {
	userID := getUserID(ctx)

	ctx.Request.Body = http.MaxBytesReader(ctx.Writer, ctx.Request.Body, 16<<10)
	raw, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(400, gin.H{"error": "invalid preferences"})
		return
	}
	var req updateNotificationPreferencesRequest
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &req) != nil || json.Unmarshal(raw, &fields) != nil || fields == nil {
		ctx.JSON(400, gin.H{"error": "invalid preferences"})
		return
	}
	_, hasStart := fields["quiet_hours_start"]
	_, hasEnd := fields["quiet_hours_end"]
	if hasStart != hasEnd {
		ctx.JSON(400, gin.H{"error": "provide both quiet-hour values or null for both"})
		return
	}
	if hasStart {
		if (req.QuietHoursStart == nil) != (req.QuietHoursEnd == nil) {
			ctx.JSON(400, gin.H{"error": "provide both quiet-hour values or null for both"})
			return
		}
		for _, v := range []*string{req.QuietHoursStart, req.QuietHoursEnd} {
			if v != nil {
				if _, err := time.Parse("15:04", *v); err != nil {
					if _, err = time.Parse("15:04:05", *v); err != nil {
						ctx.JSON(400, gin.H{"error": "quiet hours must be HH:MM"})
						return
					}
				}
			}
		}
	}

	prefs, err := server.notificationsFull.UpdatePreferences(ctx, db.UpsertNotificationPreferencesParams{
		UserID:          userID,
		EmailEnabled:    req.EmailEnabled,
		PushEnabled:     req.PushEnabled,
		InAppEnabled:    req.InAppEnabled,
		EmailAuth:       req.EmailAuth,
		EmailResults:    req.EmailResults,
		EmailDues:       req.EmailDues,
		EmailMessages:   req.EmailMessages,
		EmailConnect:    req.EmailConnect,
		EmailSkills:     req.EmailSkills,
		EmailAlumni:     req.EmailAlumni,
		EmailSystem:     req.EmailSystem,
		PushAuth:        req.PushAuth,
		PushResults:     req.PushResults,
		PushDues:        req.PushDues,
		PushMessages:    req.PushMessages,
		PushConnect:     req.PushConnect,
		PushSkills:      req.PushSkills,
		PushAlumni:      req.PushAlumni,
		PushSystem:      req.PushSystem,
		QuietHoursStart: req.QuietHoursStart,
		QuietHoursEnd:   req.QuietHoursEnd,
		QuietHoursSet:   hasStart,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, prefs)
}

// updateMyPushToken PUT /notifications/push-token
// Saves this device's Expo push token so CreateAndPush can actually deliver
// a native OS notification to it, not just the in-app/WebSocket ones.
func (server *Server) updateMyPushToken(ctx *gin.Context) {
	userID := getUserID(ctx)

	var req struct {
		PushToken string `json:"push_token" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "push_token is required"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if !validExpoToken(req.PushToken) {
		ctx.JSON(400, gin.H{"error": "invalid Expo push token"})
		return
	}
	if err := server.saveNotificationDevice(ctx, "expo", req.PushToken, nil); err != nil {
		ctx.JSON(500, gin.H{"error": "could not register push device"})
		return
	}
	prefs, err := queries.GetNotificationPreferences(ctx, userID)
	if err != nil {
		prefs, err = queries.UpsertNotificationPreferences(ctx, db.UpsertNotificationPreferencesParams{UserID: userID})
	}
	if err != nil {
		ctx.JSON(500, gin.H{"error": "could not load preferences"})
		return
	}
	ctx.JSON(200, prefs)

}

// unsubscribeFromEmails GET /notifications/unsubscribe/:token
// Public — no auth. Reached directly from the "Unsubscribe" link embedded
// in every outbound notification email, so the token itself is the only
// credential (same pattern as the calendar feed token).
func (server *Server) unsubscribeFromEmails(ctx *gin.Context) {
	token := ctx.Param("token")
	if token == "" || !server.bindTenantByUnsubscribeToken(ctx, token) {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "this unsubscribe link is invalid or has expired"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	userID, err := queries.GetUserIDByUnsubscribeToken(ctx, token)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "this unsubscribe link is invalid or has expired"})
		return
	}

	// Preserve the recipient's existing settings; the dispatcher also supports
	// partial preference updates without resetting unrelated fields.
	params := db.UpsertNotificationPreferencesParams{UserID: userID}
	if existing, prefErr := server.notificationsFull.GetPreferences(ctx, userID); prefErr == nil {
		params = notificationPreferencesToUpsertParams(existing)
	}
	emailEnabled := false
	params.EmailEnabled = &emailEnabled

	if _, err := server.notificationsFull.UpdatePreferences(ctx, params); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "You've been unsubscribed from email notifications."})
}

func notificationPreferencesToUpsertParams(p db.NotificationPreferenceView) db.UpsertNotificationPreferencesParams {
	return db.UpsertNotificationPreferencesParams{
		UserID:        p.UserID,
		EmailEnabled:  &p.EmailEnabled,
		PushEnabled:   &p.PushEnabled,
		InAppEnabled:  &p.InAppEnabled,
		EmailAuth:     &p.EmailAuth,
		EmailResults:  &p.EmailResults,
		EmailDues:     &p.EmailDues,
		EmailMessages: &p.EmailMessages,
		EmailConnect:  &p.EmailConnect,
		EmailSkills:   &p.EmailSkills,
		EmailAlumni:   &p.EmailAlumni,
		EmailSystem:   &p.EmailSystem,
		PushAuth:      &p.PushAuth,
		PushResults:   &p.PushResults,
		PushDues:      &p.PushDues,
		PushMessages:  &p.PushMessages,
		PushConnect:   &p.PushConnect,
		PushSkills:    &p.PushSkills,
		PushAlumni:    &p.PushAlumni,
		PushSystem:    &p.PushSystem,
	}
}
