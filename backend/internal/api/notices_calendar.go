package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ─── Class Notice Board ──────────────────────────────────────────────────────

type createNoticeRequest struct {
	Title         string   `json:"title" binding:"required"`
	Content       string   `json:"content" binding:"required"`
	IsPinned      bool     `json:"is_pinned"`
	AllowComments *bool    `json:"allow_comments"`
	AttachmentURL *string  `json:"attachment_url"`
	ExpiresAt     *string  `json:"expires_at"`
	TargetUserIDs []string `json:"target_user_ids"` // empty/omitted = everyone in the author's level
}

func (server *Server) createClassNotice(ctx *gin.Context) {
	var req createNoticeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
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

	// A notice authored by a class rep is scoped to their own level; hod/
	// admin accounts have no student record at all, so their notices stay
	// campus-wide (level = NULL), matching how the board behaved before
	// level-scoping existed. class_rep_assignments is the primary source
	// for a rep's level but is frequently empty in practice (roles are
	// tracked via user_role_assignments instead) — students.level is the
	// same fallback every other class-rep handler in this file's package
	// already relies on.
	var level *int32
	var roster []db.Student
	if assignment, err := queries.GetActiveClassRepAssignment(ctx, userID); err == nil {
		level = &assignment.Level
		roster, _ = queries.ListStudentsByLevel(ctx, assignment.Level)
	} else if student, serr := queries.GetStudentByUserId(ctx, userID); serr == nil {
		level = &student.Level
		roster, _ = queries.ListStudentsByLevel(ctx, student.Level)
	}

	// Reject any target not actually in the author's own level roster —
	// otherwise a class rep could target an arbitrary user id and leak a
	// notice meant to be private to their class.
	targetUserIDs := []string{}
	if len(req.TargetUserIDs) > 0 {
		validIDs := make(map[string]bool, len(roster))
		for _, s := range roster {
			validIDs[s.UserID.String()] = true
		}
		for _, id := range req.TargetUserIDs {
			if validIDs[id] {
				targetUserIDs = append(targetUserIDs, id)
			}
		}
	}
	targetJSON, err := json.Marshal(targetUserIDs)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	notice, err := queries.CreateClassNotice(ctx, db.CreateClassNoticeParams{
		ClassRepID:    userID,
		Title:         req.Title,
		Content:       req.Content,
		IsPinned:      req.IsPinned,
		AllowComments: req.AllowComments,
		AttachmentUrl: req.AttachmentURL,
		ExpiresAt:     expiresAt,
		Level:         level,
		TargetUserIds: targetJSON,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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

	userID := getUserID(ctx)

	// Staff with no student record see every level (viewerLevel stays nil);
	// students — including class reps, who are also students — only see
	// notices for their own level plus any campus-wide (level = NULL) ones.
	var viewerLevel *int32
	if student, err := queries.GetStudentByUserId(ctx, userID); err == nil {
		viewerLevel = &student.Level
	}

	notices, err := queries.ListClassNoticesForViewer(ctx, db.ListClassNoticesForViewerParams{
		ViewerLevel: viewerLevel,
		ViewerID:    userID.String(),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
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
	if !isStaffRole(ctx) && existing.ClassRepID != userID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you do not own this notice"})
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
		ClassRepID:    existing.ClassRepID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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

	existing, err := queries.GetClassNotice(ctx, noticeID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "notice not found"})
		return
	}
	if !isStaffRole(ctx) && existing.ClassRepID != userID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you do not own this notice"})
		return
	}

	err = queries.DeleteClassNotice(ctx, db.DeleteClassNoticeParams{
		ID:         noticeID,
		ClassRepID: existing.ClassRepID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": comments})
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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

// downloadDepartmentalEventICS GET /calendar/:id/ics — a standard .ics file
// any phone/desktop calendar app can import via "Add to Calendar".
func (server *Server) downloadDepartmentalEventICS(ctx *gin.Context) {
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

	description := ""
	if event.Description != nil {
		description = *event.Description
	}
	venue := ""
	if event.Venue != nil {
		venue = *event.Venue
	}

	icsBytes := utils.GenerateICS(utils.ICSEvent{
		UID:         event.ID.String(),
		Title:       event.Title,
		Description: description,
		Location:    venue,
		Start:       event.StartTime.Time,
		End:         event.EndTime.Time,
	})

	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.ics\"", event.ID.String()))
	ctx.Data(http.StatusOK, "text/calendar; charset=utf-8", icsBytes)
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "event deleted"})
}

func (server *Server) updateDepartmentalEvent(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid event id"})
		return
	}

	var req createEventRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

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

	err = queries.UpdateDepartmentalEvent(ctx, db.UpdateDepartmentalEventParams{
		ID:             id,
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "event updated"})
}
