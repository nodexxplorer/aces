package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ==================== ADMIN ANNOUNCEMENT CRUD ====================

func (server *Server) createAnnouncementV2(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		Title                  string           `json:"title" binding:"required"`
		Content                string           `json:"content" binding:"required"`
		Summary                *string          `json:"summary"`
		Priority               string           `json:"priority"`
		Category               string           `json:"category"`
		IsPinned               bool             `json:"is_pinned"`
		TargetLevel            *int32           `json:"target_level"`
		TargetAudience         []string         `json:"target_audience"`
		TargetLevels           []int32          `json:"target_levels"`
		TargetDepartments      []string         `json:"target_departments"`
		Attachments            []map[string]any `json:"attachments"`
		RequiresAcknowledgment bool             `json:"requires_acknowledgment"`
		Status                 string           `json:"status"`
		ScheduledFor           *string          `json:"scheduled_for"`
		ExpiresAt              *string          `json:"expires_at"`
		PinOrder               *int32           `json:"pin_order"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Priority == "" {
		req.Priority = "general"
	}
	if req.Category == "" {
		req.Category = "academic"
	}
	if req.Status == "" {
		req.Status = "published"
	}

	targetAudience, _ := json.Marshal(req.TargetAudience)
	targetLevels, _ := json.Marshal(req.TargetLevels)
	targetDepts, _ := json.Marshal(req.TargetDepartments)
	attachments, _ := json.Marshal(req.Attachments)

	var scheduledFor pgtype.Timestamptz
	if req.ScheduledFor != nil {
		if t, err := time.Parse(time.RFC3339, *req.ScheduledFor); err == nil {
			scheduledFor = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}

	if req.IsPinned {
		pinOrder := int32(1)
		req.PinOrder = &pinOrder
	}

	announcement, err := queries.CreateAnnouncementV2(ctx, db.CreateAnnouncementV2Params{
		Title:                  req.Title,
		Content:                req.Content,
		Summary:                req.Summary,
		Priority:               req.Priority,
		Category:               req.Category,
		IsPinned:               req.IsPinned,
		TargetLevel:            req.TargetLevel,
		TargetAudience:         targetAudience,
		TargetLevels:           targetLevels,
		TargetDepartments:      targetDepts,
		Attachments:            attachments,
		RequiresAcknowledgment: req.RequiresAcknowledgment,
		Status:                 req.Status,
		ScheduledFor:           scheduledFor,
		CreatedBy:              userID,
		PinOrder:               req.PinOrder,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"data": announcement})
}

func (server *Server) listAdminAnnouncements(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	statusFilter := ctx.Query("status")
	priorityFilter := ctx.Query("priority")
	categoryFilter := ctx.Query("category")

	limit := int32(20)
	offset := int32(0)
	if l := ctx.Query("limit"); l != "" {
		if v, err := strconv.ParseInt(l, 10, 32); err == nil {
			limit = int32(v)
		}
	}
	if o := ctx.Query("offset"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 32); err == nil {
			offset = int32(v)
		}
	}

	var status *string
	if statusFilter != "" {
		status = &statusFilter
	}
	var priority *string
	if priorityFilter != "" {
		priority = &priorityFilter
	}
	var category *string
	if categoryFilter != "" {
		category = &categoryFilter
	}

	announcements, err := queries.ListAnnouncementsV2(ctx, db.ListAnnouncementsV2Params{
		Column1: status,
		Column2: priority,
		Column3: category,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": announcements})
}

func (server *Server) getAnnouncementV2(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	announcement, err := queries.GetAnnouncementV2(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "announcement not found"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": announcement})
}

func (server *Server) updateAnnouncementV2(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	existing, err := queries.GetAnnouncementV2(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "announcement not found"})
		return
	}

	var req struct {
		Title                  *string          `json:"title"`
		Content                *string          `json:"content"`
		Summary                *string          `json:"summary"`
		Priority               *string          `json:"priority"`
		Category               *string          `json:"category"`
		IsPinned               *bool            `json:"is_pinned"`
		TargetLevel            *int32           `json:"target_level"`
		TargetAudience         []string         `json:"target_audience"`
		TargetLevels           []int32          `json:"target_levels"`
		TargetDepartments      []string         `json:"target_departments"`
		Attachments            []map[string]any `json:"attachments"`
		RequiresAcknowledgment *bool            `json:"requires_acknowledgment"`
		Status                 *string          `json:"status"`
		ExpiresAt              *string          `json:"expires_at"`
		PinOrder               *int32           `json:"pin_order"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	title := existing.Title
	if req.Title != nil {
		title = *req.Title
	}
	content := existing.Content
	if req.Content != nil {
		content = *req.Content
	}

	targetAudience := existing.TargetAudience
	if req.TargetAudience != nil {
		targetAudience, _ = json.Marshal(req.TargetAudience)
	}
	targetLevels := existing.TargetLevels
	if req.TargetLevels != nil {
		targetLevels, _ = json.Marshal(req.TargetLevels)
	}
	targetDepts := existing.TargetDepartments
	if req.TargetDepartments != nil {
		targetDepts, _ = json.Marshal(req.TargetDepartments)
	}
	attachments := existing.Attachments
	if req.Attachments != nil {
		attachments, _ = json.Marshal(req.Attachments)
	}

	var expiresAt pgtype.Timestamptz
	if req.ExpiresAt != nil {
		if t, err := time.Parse(time.RFC3339, *req.ExpiresAt); err == nil {
			expiresAt = pgtype.Timestamptz{Time: t, Valid: true}
		}
	} else {
		expiresAt = existing.ExpiresAt
	}

	isPinned := existing.IsPinned
	if req.IsPinned != nil {
		isPinned = *req.IsPinned
	}
	reqAck := existing.RequiresAcknowledgment
	if req.RequiresAcknowledgment != nil {
		reqAck = *req.RequiresAcknowledgment
	}
	priority := existing.Priority
	if req.Priority != nil {
		priority = req.Priority
	}
	category := existing.Category
	if req.Category != nil {
		category = req.Category
	}
	statusVal := existing.Status
	if req.Status != nil {
		statusVal = req.Status
	}

	err = queries.UpdateAnnouncementV2(ctx, db.UpdateAnnouncementV2Params{
		ID:                     id,
		Title:                  title,
		Content:                content,
		Summary:                req.Summary,
		Priority:               priority,
		Category:               category,
		IsPinned:               isPinned,
		TargetLevel:            req.TargetLevel,
		TargetAudience:         targetAudience,
		TargetLevels:           targetLevels,
		TargetDepartments:      targetDepts,
		Attachments:            attachments,
		RequiresAcknowledgment: reqAck,
		Status:                 statusVal,
		ScheduledFor:           pgtype.Timestamptz{},
		ExpiresAt:              expiresAt,
		PinOrder:               req.PinOrder,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "announcement updated"})
}

func (server *Server) deleteAnnouncementV2(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	if err := queries.DeleteAnnouncementV2(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "announcement deleted"})
}

func (server *Server) publishAnnouncement(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	if err := queries.PublishAnnouncement(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "announcement published"})
}

func (server *Server) archiveAnnouncement(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	if err := queries.ArchiveAnnouncement(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "announcement archived"})
}

func (server *Server) getAnnouncementStats(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	stats, err := queries.CountAnnouncementsByStatus(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": stats})
}

// ==================== STUDENT ANNOUNCEMENTS ====================

func (server *Server) listStudentAnnouncements(ctx *gin.Context) {
	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	limit := int32(20)
	offset := int32(0)
	if l := ctx.Query("limit"); l != "" {
		if v, err := strconv.ParseInt(l, 10, 32); err == nil {
			limit = int32(v)
		}
	}
	if o := ctx.Query("offset"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 32); err == nil {
			offset = int32(v)
		}
	}

	announcements, err := queries.ListStudentAnnouncements(ctx, db.ListStudentAnnouncementsParams{
		TargetLevel: nil,
		Column2:     userID.String(),
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": announcements})
}

func (server *Server) searchStudentAnnouncements(ctx *gin.Context) {
	q := ctx.Query("q")
	if q == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "query parameter q is required"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	results, err := queries.SearchAnnouncements(ctx, db.SearchAnnouncementsParams{
		Column1: &q,
		Limit:   20,
		Offset:  0,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": results})
}

// ==================== READ RECEIPTS & ACKNOWLEDGMENT ====================

func (server *Server) markAnnouncementRead(ctx *gin.Context) {
	userID := getUserID(ctx)
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	deviceType := ctx.GetHeader("User-Agent")
	if len(deviceType) > 20 {
		deviceType = deviceType[:20]
	}

	_ = queries.MarkAnnouncementRead(ctx, db.MarkAnnouncementReadParams{
		AnnouncementID: id,
		StudentID:      userID,
		DeviceType:     &deviceType,
	})
	_ = queries.IncrementAnnouncementReadCount(ctx, id)

	ctx.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}

func (server *Server) acknowledgeAnnouncement(ctx *gin.Context) {
	userID := getUserID(ctx)
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	deviceType := "web"

	_ = queries.AcknowledgeAnnouncement(ctx, db.AcknowledgeAnnouncementParams{
		AnnouncementID: id,
		StudentID:      userID,
		DeviceType:     &deviceType,
	})
	_ = queries.IncrementAnnouncementAckCount(ctx, id)

	ctx.JSON(http.StatusOK, gin.H{"message": "acknowledged"})
}

func (server *Server) getAnnouncementReadStatus(ctx *gin.Context) {
	userID := getUserID(ctx)
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	read, _ := queries.HasStudentReadAnnouncement(ctx, db.HasStudentReadAnnouncementParams{
		AnnouncementID: id,
		StudentID:      userID,
	})
	acknowledged, _ := queries.HasStudentAcknowledgedAnnouncement(ctx, db.HasStudentAcknowledgedAnnouncementParams{
		AnnouncementID: id,
		StudentID:      userID,
	})

	ctx.JSON(http.StatusOK, gin.H{"read": read, "acknowledged": acknowledged})
}

func (server *Server) listAnnouncementReceipts(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	receipts, err := queries.ListReadReceiptsByAnnouncement(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": receipts})
}

func (server *Server) listUnacknowledgedStudentsHandler(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	students, err := queries.ListUnacknowledgedStudents(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": students})
}

func (server *Server) getReceiptStats(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	stats, err := queries.GetAnnouncementReceiptStats(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": stats})
}

// ==================== COMMENTS ====================

func (server *Server) createAnnouncementCommentHandler(ctx *gin.Context) {
	userID := getUserID(ctx)
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		Content          string  `json:"content" binding:"required"`
		ParentCommentID  *string `json:"parent_comment_id"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var parentID pgtype.UUID
	if req.ParentCommentID != nil {
		pid, err := uuid.Parse(*req.ParentCommentID)
		if err == nil {
			parentID = pgtype.UUID{Bytes: pid, Valid: true}
		}
	}

	comment, err := queries.CreateAnnouncementComment(ctx, db.CreateAnnouncementCommentParams{
		AnnouncementID:  id,
		AuthorID:        userID,
		ParentCommentID: parentID,
		Content:         req.Content,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"data": comment})
}

func (server *Server) listAnnouncementCommentsHandler(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid announcement ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	comments, err := queries.ListAnnouncementComments(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": comments})
}

func (server *Server) deleteAnnouncementCommentHandler(ctx *gin.Context) {
	userID := getUserID(ctx)
	commentID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid comment ID"})
		return
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	if err := queries.DeleteAnnouncementComment(ctx, db.DeleteAnnouncementCommentParams{ID: commentID, AuthorID: userID}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "comment deleted"})
}

// ==================== TEMPLATES ====================

func (server *Server) listAnnouncementTemplatesHandler(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	templates, err := queries.ListAnnouncementTemplates(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": templates})
}

func (server *Server) createAnnouncementTemplateHandler(ctx *gin.Context) {
	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		Name                          string `json:"name" binding:"required"`
		DefaultTitle                  string `json:"default_title" binding:"required"`
		DefaultBody                   string `json:"default_body" binding:"required"`
		DefaultPriority               string `json:"default_priority"`
		DefaultCategory               string `json:"default_category"`
		DefaultRequiresAcknowledgment bool   `json:"default_requires_acknowledgment"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.DefaultPriority == "" {
		req.DefaultPriority = "general"
	}
	if req.DefaultCategory == "" {
		req.DefaultCategory = "academic"
	}

	template, err := queries.CreateAnnouncementTemplate(ctx, db.CreateAnnouncementTemplateParams{
		Name:                          req.Name,
		DefaultTitle:                  req.DefaultTitle,
		DefaultBody:                   req.DefaultBody,
		DefaultPriority:               req.DefaultPriority,
		DefaultCategory:               req.DefaultCategory,
		DefaultRequiresAcknowledgment: req.DefaultRequiresAcknowledgment,
		CreatedBy:                     pgtype.UUID{Bytes: userID, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"data": template})
}

// helper to check if string contains substring (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
