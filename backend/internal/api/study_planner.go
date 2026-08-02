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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	priority := strings.ToLower(strings.TrimSpace(req.Priority))
	switch priority {
	case "high", "medium", "low":
	case "":
		priority = "medium"
	default:
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid priority; must be high, medium, or low"})
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "title cannot be empty"})
		return
	}

	arg := db.CreateStudyTaskParams{
		UserID:     userID,
		Title:      title,
		Priority:   db.TaskPriority(priority),
		DueDate:    pgtype.Timestamptz{Valid: false},
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if tasks == nil {
		tasks = []db.ListUserStudyTasksRow{}
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	existing, err := queries.GetStudyTask(ctx, db.GetStudyTaskParams{ID: taskID, UserID: userID})
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	arg := db.UpdateStudyTaskParams{
		ID:          taskID,
		UserID:      userID,
		Title:       existing.Title,
		Description: existing.Description,
		Priority:    existing.Priority,
		Status:      existing.Status,
		DueDate:     existing.DueDate,
		ReminderAt:  existing.ReminderAt,
	}

	if req.Title != nil {
		arg.Title = strings.TrimSpace(*req.Title)
		if arg.Title == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "title cannot be empty"})
			return
		}
	}
	if req.Description != nil {
		arg.Description = req.Description
	}
	if req.Priority != nil {
		p := strings.ToLower(strings.TrimSpace(*req.Priority))
		switch p {
		case "high", "medium", "low":
			arg.Priority = db.TaskPriority(p)
		case "":
			arg.Priority = "medium"
		default:
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid priority; must be high, medium, or low"})
			return
		}
	}
	if req.Status != nil {
		s := strings.ToLower(strings.TrimSpace(*req.Status))
		switch s {
		case "pending", "in_progress", "completed", "cancelled":
			arg.Status = db.TaskStatus(s)
		case "":
			arg.Status = "pending"
		default:
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid status; must be pending, in_progress, completed, or cancelled"})
			return
		}
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update task"})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if tasks == nil {
		tasks = []db.GetUpcomingTasksRow{}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": tasks})
}
