package api

import (
	"net/http"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createTaskRequest struct {
	CourseID    *string `json:"course_id"`
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	Priority    string  `json:"priority"`
	DueDate     *string `json:"due_date"`
	ReminderAt  *string `json:"reminder_at"`
}

func (server *Server) createStudyTask(ctx *gin.Context) {
	var req createTaskRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	arg := db.CreateStudyTaskParams{
		UserID:    userID,
		Title:     strings.TrimSpace(req.Title),
		Priority:  db.TaskPriority(req.Priority),
		DueDate:   pgtype.Timestamptz{Valid: false},
		ReminderAt: pgtype.Timestamptz{Valid: false},
	}

	if req.Description != nil {
		arg.Description = req.Description
	}

	if req.CourseID != nil {
		cid, err := uuid.Parse(*req.CourseID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
			return
		}
		arg.CourseID = pgtype.UUID{Bytes: cid, Valid: true}
	}

	if req.DueDate != nil {
		t, err := time.Parse(time.RFC3339, *req.DueDate)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid due_date format"})
			return
		}
		arg.DueDate = pgtype.Timestamptz{Time: t, Valid: true}
	}

	if req.ReminderAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ReminderAt)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid reminder_at format"})
			return
		}
		arg.ReminderAt = pgtype.Timestamptz{Time: t, Valid: true}
	}

	task, err := queries.CreateStudyTask(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": task})
}

func (server *Server) listMyStudyTasks(ctx *gin.Context) {
	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	tasks, err := queries.ListUserStudyTasks(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": tasks})
}

func (server *Server) getStudyTask(ctx *gin.Context) {
	taskID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	task, err := queries.GetStudyTask(ctx, db.GetStudyTaskParams{ID: taskID, UserID: userID})
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": task})
}

type updateTaskRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Priority    *string `json:"priority"`
	Status      *string `json:"status"`
	DueDate     *string `json:"due_date"`
	ReminderAt  *string `json:"reminder_at"`
}

func (server *Server) updateStudyTask(ctx *gin.Context) {
	taskID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	userID := getUserID(ctx)

	var req updateTaskRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// Fetch existing task to preserve fields not being updated
	existing, err := queries.GetStudyTask(ctx, db.GetStudyTaskParams{ID: taskID, UserID: userID})
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	arg := db.UpdateStudyTaskParams{
		ID:         taskID,
		UserID:     userID,
		Title:      existing.Title,
		Description: existing.Description,
		Priority:   existing.Priority,
		Status:     existing.Status,
		DueDate:    existing.DueDate,
		ReminderAt: existing.ReminderAt,
	}

	if req.Title != nil {
		arg.Title = strings.TrimSpace(*req.Title)
	}
	if req.Description != nil {
		arg.Description = req.Description
	}
	if req.Priority != nil {
		arg.Priority = db.TaskPriority(*req.Priority)
	}
	if req.Status != nil {
		arg.Status = db.TaskStatus(*req.Status)
	}
	if req.DueDate != nil {
		t, err := time.Parse(time.RFC3339, *req.DueDate)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid due_date format"})
			return
		}
		arg.DueDate = pgtype.Timestamptz{Time: t, Valid: true}
	}
	if req.ReminderAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ReminderAt)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid reminder_at format"})
			return
		}
		arg.ReminderAt = pgtype.Timestamptz{Time: t, Valid: true}
	}

	if err := queries.UpdateStudyTask(ctx, arg); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "task updated"})
}

func (server *Server) deleteStudyTask(ctx *gin.Context) {
	taskID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.DeleteStudyTask(ctx, db.DeleteStudyTaskParams{ID: taskID, UserID: userID}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "task deleted"})
}

func (server *Server) getUpcomingTasks(ctx *gin.Context) {
	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	arg := db.GetUpcomingTasksParams{
		UserID:  userID,
		DueDate: pgtype.Timestamptz{Time: time.Now().Add(7 * 24 * time.Hour), Valid: true},
	}

	tasks, err := queries.GetUpcomingTasks(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": tasks})
}
