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

// ─── Request/Response types ───────────────────────────────────────────────────

type createTimetableEntryRequest struct {
	CourseID        string          `json:"course_id" binding:"required,uuid"`
	ExamDate        string          `json:"exam_date" binding:"required"` // RFC3339
	StartTime       string          `json:"start_time" binding:"required"` // RFC3339
	EndTime         string          `json:"end_time" binding:"required"` // RFC3339
	Venue           string          `json:"venue" binding:"required"`
	SessionID       string          `json:"session_id" binding:"required,uuid"`
	SemesterID      string          `json:"semester_id" binding:"required,uuid"`
	HasConflict     bool            `json:"has_conflict"`
	ConflictDetails json.RawMessage `json:"conflict_details"`
	CreatedBy       string          `json:"created_by" binding:"required,uuid"`
}

type listTimetableQuery struct {
	SessionID  string `form:"session_id" binding:"required,uuid"`
	SemesterID string `form:"semester_id" binding:"required,uuid"`
}

type updateTimetableEntryRequest struct {
	ExamDate        string          `json:"exam_date" binding:"required"` // RFC3339
	StartTime       string          `json:"start_time" binding:"required"` // RFC3339
	EndTime         string          `json:"end_time" binding:"required"` // RFC3339
	Venue           string          `json:"venue" binding:"required"`
	HasConflict     bool            `json:"has_conflict"`
	ConflictDetails json.RawMessage `json:"conflict_details"`
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// createTimetableEntry POST /timetable
func (server *Server) createTimetableEntry(ctx *gin.Context) {
	var req createTimetableEntryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	semesterID, err := uuid.Parse(req.SemesterID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester_id"})
		return
	}

	createdBy, err := uuid.Parse(req.CreatedBy)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid created_by"})
		return
	}

	examDate, err := time.Parse(time.RFC3339, req.ExamDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid exam_date, expected RFC3339"})
		return
	}

	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time, expected RFC3339"})
		return
	}

	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time, expected RFC3339"})
		return
	}

	entry, err := server.store.CreateTimetableEntry(ctx, db.CreateTimetableEntryParams{
		CourseID:        courseID,
		ExamDate:        pgtype.Timestamptz{Time: examDate, Valid: true},
		StartTime:       pgtype.Timestamptz{Time: startTime, Valid: true},
		EndTime:         pgtype.Timestamptz{Time: endTime, Valid: true},
		Venue:           req.Venue,
		SessionID:       sessionID,
		SemesterID:      semesterID,
		HasConflict:     req.HasConflict,
		ConflictDetails: req.ConflictDetails,
		CreatedBy:       createdBy,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, entry)
}

// getTimetableEntry GET /timetable/:id
func (server *Server) getTimetableEntry(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable id"})
		return
	}

	entry, err := server.store.GetTimetableEntry(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "timetable entry not found"})
		return
	}

	ctx.JSON(http.StatusOK, entry)
}

// listTimetableEntries GET /timetable
func (server *Server) listTimetableEntries(ctx *gin.Context) {
	var q listTimetableQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sessionID, err := uuid.Parse(q.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	semesterID, err := uuid.Parse(q.SemesterID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester_id"})
		return
	}

	entries, err := server.store.ListTimetableEntries(ctx, db.ListTimetableEntriesParams{
		SessionID:  sessionID,
		SemesterID: semesterID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, entries)
}

// updateTimetableEntry PUT /timetable/:id
func (server *Server) updateTimetableEntry(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable id"})
		return
	}

	var req updateTimetableEntryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	examDate, err := time.Parse(time.RFC3339, req.ExamDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid exam_date, expected RFC3339"})
		return
	}

	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time, expected RFC3339"})
		return
	}

	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time, expected RFC3339"})
		return
	}

	entry, err := server.store.UpdateTimetableEntry(ctx, db.UpdateTimetableEntryParams{
		ID:              id,
		ExamDate:        pgtype.Timestamptz{Time: examDate, Valid: true},
		StartTime:       pgtype.Timestamptz{Time: startTime, Valid: true},
		EndTime:         pgtype.Timestamptz{Time: endTime, Valid: true},
		Venue:           req.Venue,
		HasConflict:     req.HasConflict,
		ConflictDetails: req.ConflictDetails,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, entry)
}

// deleteTimetableEntry DELETE /timetable/:id
func (server *Server) deleteTimetableEntry(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable id"})
		return
	}

	if err := server.store.DeleteTimetableEntry(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "timetable entry deleted successfully"})
}
