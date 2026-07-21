package api

import (
	"encoding/json"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ─── Class Notice Board ──────────────────────────────────────────────────────

type createNoticeRequest struct {
	Title         string  `json:"title" binding:"required"`
	Content       string  `json:"content" binding:"required"`
	IsPinned      bool    `json:"is_pinned"`
	AllowComments *bool   `json:"allow_comments"`
	AttachmentURL *string `json:"attachment_url"`
	ExpiresAt     *string `json:"expires_at"`
}

func (server *Server) createClassNotice(ctx *gin.Context) {
	var req createNoticeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	userID := getUserID(ctx)

	var expiresAt pgtype.Timestamptz
	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid expires_at format, use RFC3339"})
			return
		}
		expiresAt = pgtype.Timestamptz{Time: t, Valid: true}
	}

	notice, err := queries.CreateClassNotice(ctx, db.CreateClassNoticeParams{
		ClassRepID:    userID,
		Title:         req.Title,
		Content:       req.Content,
		IsPinned:      req.IsPinned,
		AllowComments: req.AllowComments,
		AttachmentUrl: req.AttachmentURL,
		ExpiresAt:     expiresAt,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": notice})
}

func (server *Server) listClassNotices(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	notices, err := queries.ListClassNotices(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": notices})
}

func (server *Server) getClassNotice(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid notice id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	notice, err := queries.GetClassNotice(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "notice not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": notice})
}

type updateNoticeRequest struct {
	Title         *string `json:"title"`
	Content       *string `json:"content"`
	IsPinned      *bool   `json:"is_pinned"`
	AllowComments *bool   `json:"allow_comments"`
	AttachmentURL *string `json:"attachment_url"`
	ExpiresAt     *string `json:"expires_at"`
}

func (server *Server) updateClassNotice(ctx *gin.Context) {
	noticeID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid notice id"})
		return
	}

	var req updateNoticeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	userID := getUserID(ctx)

	existing, err := queries.GetClassNotice(ctx, noticeID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "notice not found"})
		return
	}
	if existing.ClassRepID != userID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "only the author can update this notice"})
		return
	}

	title := existing.Title
	content := existing.Content
	isPinned := existing.IsPinned
	allowComments := existing.AllowComments
	attachmentURL := existing.AttachmentUrl
	expiresAt := existing.ExpiresAt

	if req.Title != nil {
		title = *req.Title
	}
	if req.Content != nil {
		content = *req.Content
	}
	if req.IsPinned != nil {
		isPinned = *req.IsPinned
	}
	if req.AllowComments != nil {
		allowComments = req.AllowComments
	}
	if req.AttachmentURL != nil {
		attachmentURL = req.AttachmentURL
	}
	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid expires_at format, use RFC3339"})
			return
		}
		expiresAt = pgtype.Timestamptz{Time: t, Valid: true}
	}

	err = queries.UpdateClassNotice(ctx, db.UpdateClassNoticeParams{
		ID:            noticeID,
		Title:         title,
		Content:       content,
		IsPinned:      isPinned,
		AllowComments: allowComments,
		AttachmentUrl: attachmentURL,
		ExpiresAt:     expiresAt,
		ClassRepID:    userID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "notice updated"})
}

func (server *Server) deleteClassNotice(ctx *gin.Context) {
	noticeID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid notice id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	userID := getUserID(ctx)

	err = queries.DeleteClassNotice(ctx, db.DeleteClassNoticeParams{
		ID:         noticeID,
		ClassRepID: userID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "notice deleted"})
}

type createNoticeCommentRequest struct {
	Content string `json:"content" binding:"required"`
}

func (server *Server) createNoticeComment(ctx *gin.Context) {
	noticeID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid notice id"})
		return
	}

	var req createNoticeCommentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	userID := getUserID(ctx)

	comment, err := queries.CreateNoticeComment(ctx, db.CreateNoticeCommentParams{
		NoticeID: noticeID,
		UserID:   userID,
		Content:  req.Content,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": comment})
}

func (server *Server) listNoticeComments(ctx *gin.Context) {
	noticeID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid notice id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	comments, err := queries.ListNoticeComments(ctx, noticeID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": comments})
}

// ─── Emergency Broadcasts ────────────────────────────────────────────────────

type createBroadcastRequest struct {
	Title                  string   `json:"title" binding:"required"`
	Message                string   `json:"message" binding:"required"`
	Priority               string   `json:"priority"`
	Template               *string  `json:"template"`
	Channels               []string `json:"channels"`
	TargetRoles            []string `json:"target_roles"`
	RequiresAcknowledgment bool     `json:"requires_acknowledgment"`
}

func (server *Server) createBroadcast(ctx *gin.Context) {
	var req createBroadcastRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	userID := getUserID(ctx)

	priority := db.BroadcastPriority(req.Priority)
	if priority == "" {
		priority = db.BroadcastPriorityNormal
	}

	channelsJSON, err := json.Marshal(req.Channels)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal channels"})
		return
	}

	targetRolesJSON, err := json.Marshal(req.TargetRoles)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal target roles"})
		return
	}

	broadcast, err := queries.CreateBroadcast(ctx, db.CreateBroadcastParams{
		SenderID:               userID,
		Title:                  req.Title,
		Message:                req.Message,
		Priority:               priority,
		Template:               req.Template,
		Channels:               channelsJSON,
		TargetRoles:            targetRolesJSON,
		RequiresAcknowledgment: &req.RequiresAcknowledgment,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": broadcast})
}

func (server *Server) listBroadcasts(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	userID := getUserID(ctx)
	role := ctx.GetString("role")

	broadcasts, err := queries.ListUserBroadcasts(ctx, db.ListUserBroadcastsParams{
		UserID:  userID,
		Column2: role,
		Limit:   20,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": broadcasts})
}

func (server *Server) getBroadcast(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid broadcast id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	broadcast, err := queries.GetBroadcast(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "broadcast not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": broadcast})
}

func (server *Server) acknowledgeBroadcast(ctx *gin.Context) {
	broadcastID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid broadcast id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	userID := getUserID(ctx)

	err = queries.AcknowledgeBroadcast(ctx, db.AcknowledgeBroadcastParams{
		BroadcastID: broadcastID,
		UserID:      userID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "broadcast acknowledged"})
}

func (server *Server) getBroadcastAckCount(ctx *gin.Context) {
	broadcastID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid broadcast id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	count, err := queries.GetBroadcastAckCount(ctx, broadcastID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": gin.H{"ack_count": count}})
}

// ─── Departmental Calendar ───────────────────────────────────────────────────

type createEventRequest struct {
	Title          string   `json:"title" binding:"required"`
	Description    *string  `json:"description"`
	EventType      string   `json:"event_type" binding:"required"`
	StartTime      string   `json:"start_time" binding:"required"`
	EndTime        *string  `json:"end_time"`
	Venue          *string  `json:"venue"`
	TargetLevels   []int    `json:"target_levels"`
	TargetAudience []string `json:"target_audience"`
	IsAllDay       bool     `json:"is_all_day"`
	Color          *string  `json:"color"`
}

func (server *Server) createDepartmentalEvent(ctx *gin.Context) {
	var req createEventRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	userID := getUserID(ctx)

	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format, use RFC3339"})
		return
	}

	var endTime pgtype.Timestamptz
	if req.EndTime != nil {
		t, err := time.Parse(time.RFC3339, *req.EndTime)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format, use RFC3339"})
			return
		}
		endTime = pgtype.Timestamptz{Time: t, Valid: true}
	}

	targetLevelsJSON, err := json.Marshal(req.TargetLevels)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal target_levels"})
		return
	}

	targetAudienceJSON, err := json.Marshal(req.TargetAudience)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal target_audience"})
		return
	}

	event, err := queries.CreateDepartmentalEvent(ctx, db.CreateDepartmentalEventParams{
		CreatorID:      userID,
		Title:          req.Title,
		Description:    req.Description,
		EventType:      db.CalendarEventType(req.EventType),
		StartTime:      pgtype.Timestamptz{Time: startTime, Valid: true},
		EndTime:        endTime,
		Venue:          req.Venue,
		TargetLevels:   targetLevelsJSON,
		TargetAudience: targetAudienceJSON,
		IsAllDay:       &req.IsAllDay,
		Color:          req.Color,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": event})
}

type listDepartmentalEventsRequest struct {
	Start string `form:"start"`
	End   string `form:"end"`
}

func (server *Server) listDepartmentalEvents(ctx *gin.Context) {
	var req listDepartmentalEventsRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	now := time.Now()
	start := now
	end := now.AddDate(0, 0, 30)

	if req.Start != "" {
		parsed, err := time.Parse(time.RFC3339, req.Start)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid start format, use RFC3339"})
			return
		}
		start = parsed
	}
	if req.End != "" {
		parsed, err := time.Parse(time.RFC3339, req.End)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid end format, use RFC3339"})
			return
		}
		end = parsed
	}

	events, err := queries.ListDepartmentalEvents(ctx, db.ListDepartmentalEventsParams{
		StartTime: pgtype.Timestamptz{Time: start, Valid: true},
		EndTime:   pgtype.Timestamptz{Time: end, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": events})
}

func (server *Server) getDepartmentalEvent(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid event id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	event, err := queries.GetDepartmentalEvent(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": event})
}

func (server *Server) deleteDepartmentalEvent(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid event id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	err = queries.DeleteDepartmentalEvent(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "event deleted"})
}
