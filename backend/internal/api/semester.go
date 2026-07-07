package api

import (
	"errors"
	"net/http"
	"time"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type createSemesterRequest struct {
	SessionID            string `json:"session_id" binding:"required,uuid"`
	Name                 string `json:"name" binding:"required,oneof=harmattan rain"`
	StartDate            string `json:"start_date" binding:"required"`
	EndDate              string `json:"end_date" binding:"required"`
	RegistrationDeadline string `json:"registration_deadline" binding:"omitempty"`
}

func (server *Server) createSemester(ctx *gin.Context) {
	var req createSemesterRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	startDate, err := time.Parse(time.RFC3339, req.StartDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date format, must be RFC3339"})
		return
	}

	endDate, err := time.Parse(time.RFC3339, req.EndDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_date format, must be RFC3339"})
		return
	}

	arg := db.CreateSemesterParams{
		SessionID: sessionID,
		Name:      db.SemesterSeason(req.Name),
		StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
	}

	if req.RegistrationDeadline != "" {
		regDeadline, err := time.Parse(time.RFC3339, req.RegistrationDeadline)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid registration_deadline format, must be RFC3339"})
			return
		}
		arg.RegistrationDeadline = pgtype.Timestamptz{Time: regDeadline, Valid: true}
	} else {
		arg.RegistrationDeadline = pgtype.Timestamptz{Valid: false}
	}

	semester, err := server.store.CreateSemester(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, semester)
}

func (server *Server) getSemester(ctx *gin.Context) {
	idStr := ctx.Param("id")

	if idStr == "active" {
		semester, err := server.store.GetActiveSemester(ctx)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				ctx.JSON(http.StatusNotFound, gin.H{"error": "no active semester found"})
				return
			}
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, semester)
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester id"})
		return
	}

	semester, err := server.store.GetSemester(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "semester not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, semester)
}

func (server *Server) listSessionSemesters(ctx *gin.Context) {
	sessionIDStr := ctx.Param("session_id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	semesters, err := server.store.ListSessionSemesters(ctx, sessionID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, semesters)
}

type updateSemesterRequest struct {
	SessionID            string `json:"session_id" binding:"required,uuid"`
	Name                 string `json:"name" binding:"required,oneof=harmattan rain"`
	StartDate            string `json:"start_date" binding:"required"`
	EndDate              string `json:"end_date" binding:"required"`
	RegistrationDeadline string `json:"registration_deadline" binding:"omitempty"`
	IsActive             bool   `json:"is_active"`
}

func (server *Server) updateSemester(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester id"})
		return
	}

	var req updateSemesterRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	startDate, err := time.Parse(time.RFC3339, req.StartDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date format, must be RFC3339"})
		return
	}

	endDate, err := time.Parse(time.RFC3339, req.EndDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_date format, must be RFC3339"})
		return
	}

	arg := db.UpdateSemesterParams{
		ID:        id,
		SessionID: sessionID,
		Name:      db.SemesterSeason(req.Name),
		StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
		IsActive:  req.IsActive,
	}

	if req.RegistrationDeadline != "" {
		regDeadline, err := time.Parse(time.RFC3339, req.RegistrationDeadline)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid registration_deadline format, must be RFC3339"})
			return
		}
		arg.RegistrationDeadline = pgtype.Timestamptz{Time: regDeadline, Valid: true}
	} else {
		arg.RegistrationDeadline = pgtype.Timestamptz{Valid: false}
	}

	semester, err := server.store.UpdateSemester(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, semester)
}

func (server *Server) deleteSemester(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester id"})
		return
	}

	err = server.store.DeleteSemester(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "semester deleted"})
}
