package api

import (
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─── Announcements ────────────────────────────────────────────────────────────

type createAnnouncementRequest struct {
	Title          string   `json:"title" binding:"required"`
	Content        string   `json:"content" binding:"required"`
	IsPinned       bool     `json:"is_pinned"`
	TargetLevel    *int32   `json:"target_level"`
	TargetAudience []string `json:"target_audience"`
	ExpiresAt      string   `json:"expires_at" binding:"omitempty"`
	CreatedBy      string   `json:"created_by" binding:"required,uuid"`
}

func (server *Server) createAnnouncement(ctx *gin.Context) {
	var req createAnnouncementRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	createdBy, _ := uuid.Parse(req.CreatedBy)

	announcement, err := server.announcements.Create(ctx, service.CreateAnnouncementInput{
		Title:          req.Title,
		Content:        req.Content,
		IsPinned:       req.IsPinned,
		TargetLevel:    req.TargetLevel,
		TargetAudience: req.TargetAudience,
		ExpiresAt:      req.ExpiresAt,
		CreatedBy:      createdBy,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, announcement)
}

func (server *Server) getAnnouncement(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement id"})
		return
	}

	announcement, err := server.announcements.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "announcement not found"})
		return
	}

	ctx.JSON(http.StatusOK, announcement)
}

type listActiveAnnouncementsRequest struct {
	Limit  int32 `form:"limit" binding:"required,min=1,max=100"`
	Offset int32 `form:"offset" binding:"min=0"`
}

func (server *Server) listActiveAnnouncements(ctx *gin.Context) {
	var req listActiveAnnouncementsRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	announcements, err := server.announcements.ListActive(ctx, req.Limit, req.Offset)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, announcements)
}

type updateAnnouncementRequest struct {
	Title          string   `json:"title" binding:"required"`
	Content        string   `json:"content" binding:"required"`
	IsPinned       bool     `json:"is_pinned"`
	TargetLevel    *int32   `json:"target_level"`
	TargetAudience []string `json:"target_audience"`
	ExpiresAt      string   `json:"expires_at" binding:"omitempty"`
}

func (server *Server) updateAnnouncement(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement id"})
		return
	}

	var req updateAnnouncementRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	announcement, err := server.announcements.Update(ctx, id, service.UpdateAnnouncementInput{
		Title:          req.Title,
		Content:        req.Content,
		IsPinned:       req.IsPinned,
		TargetLevel:    req.TargetLevel,
		TargetAudience: req.TargetAudience,
		ExpiresAt:      req.ExpiresAt,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, announcement)
}

func (server *Server) deleteAnnouncement(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement id"})
		return
	}

	if err := server.announcements.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "announcement deleted successfully"})
}

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

	var req updateNotificationPreferencesRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
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
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, prefs)
}

type broadcastNotificationRequest struct {
	Title          string   `json:"title" binding:"required"`
	Message        string   `json:"message" binding:"required"`
	Category       string   `json:"category" binding:"omitempty"`
	Priority       string   `json:"priority" binding:"omitempty"`
	TargetAudience string   `json:"target_audience" binding:"required,oneof=all role level"`
	TargetRoles    []string `json:"target_roles"`
	TargetLevel    int32    `json:"target_level"`
}

func (server *Server) broadcastNotification(ctx *gin.Context) {
	var req broadcastNotificationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	senderID := getUserID(ctx)

	count, err := server.notificationsFull.BroadcastNotification(ctx,
		req.Title,
		req.Message,
		req.Category,
		req.Priority,
		req.TargetAudience,
		req.TargetRoles,
		req.TargetLevel,
		&senderID,
	)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message": "broadcast sent",
		"count":   count,
	})
}
