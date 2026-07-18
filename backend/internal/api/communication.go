package api

import (
	"net/http"

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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	announcements, err := server.announcements.ListActive(ctx, req.Limit, req.Offset)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "announcement deleted successfully"})
}

// ─── Notifications ────────────────────────────────────────────────────────────

type createNotificationRequest struct {
	UserID    string `json:"user_id" binding:"required,uuid"`
	Type      string `json:"type" binding:"required"`
	Title     string `json:"title" binding:"required"`
	Message   string `json:"message" binding:"required"`
	ActionUrl string `json:"action_url" binding:"omitempty"`
	EmailSent bool   `json:"email_sent"`
}

func (server *Server) createNotification(ctx *gin.Context) {
	var req createNotificationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := uuid.Parse(req.UserID)

	notification, err := server.notifications.Create(ctx, service.CreateNotificationInput{
		UserID:    userID,
		Type:      req.Type,
		Title:     req.Title,
		Message:   req.Message,
		ActionURL: req.ActionUrl,
		EmailSent: req.EmailSent,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, notification)
}

type listUserNotificationsRequest struct {
	Limit  int32 `form:"limit" binding:"required,min=1,max=100"`
	Offset int32 `form:"offset" binding:"min=0"`
}

func (server *Server) listUserNotifications(ctx *gin.Context) {
	userID, err := uuid.Parse(ctx.Param("user_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req listUserNotificationsRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	notifications, err := server.notifications.ListByUser(ctx, userID, req.Limit, req.Offset)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, notifications)
}

func (server *Server) markNotificationAsRead(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification id"})
		return
	}

	var req struct {
		UserID string `json:"user_id" binding:"required,uuid"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required in body"})
		return
	}
	userID, _ := uuid.Parse(req.UserID)

	notification, err := server.notifications.MarkAsRead(ctx, id, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, notification)
}

func (server *Server) markAllUserNotificationsAsRead(ctx *gin.Context) {
	userID, err := uuid.Parse(ctx.Param("user_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	err = server.notifications.MarkAllAsRead(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

	var req struct {
		UserID string `json:"user_id" binding:"required,uuid"`
	}
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required in query params"})
		return
	}
	userID, _ := uuid.Parse(req.UserID)

	if err := server.notifications.Delete(ctx, id, userID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "notification deleted successfully"})
}
