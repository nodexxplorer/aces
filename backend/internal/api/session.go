package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type createSessionRequest struct {
	Name      string `json:"name" binding:"required"`
	StartDate string `json:"start_date" binding:"required"`
	EndDate   string `json:"end_date" binding:"required"`
}

func (server *Server) createSession(ctx *gin.Context) {
	var req createSessionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	arg := db.CreateSessionParams{
		Name:      strings.TrimSpace(req.Name),
		StartDate: pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:   pgtype.Timestamptz{Time: endDate, Valid: true},
	}

	session, err := server.store.CreateSession(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, session)
}

func (server *Server) getSession(ctx *gin.Context) {
	idStr := ctx.Param("id")
	
	if idStr == "active" {
		session, err := server.store.GetActiveSession(ctx)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				ctx.JSON(http.StatusNotFound, gin.H{"error": "no active session found"})
				return
			}
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, session)
		return
	}
	
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	session, err := server.store.GetSession(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, session)
}

type listSessionsRequest struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listSessions(ctx *gin.Context) {
	var req listSessionsRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.ListSessionsParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	sessions, err := server.store.ListSessions(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, sessions)
}

type updateSessionRequest struct {
	Name       string `json:"name" binding:"required"`
	StartDate  string `json:"start_date" binding:"required"`
	EndDate    string `json:"end_date" binding:"required"`
	IsActive   bool   `json:"is_active"`
	IsArchived bool   `json:"is_archived"`
}

func (server *Server) updateSession(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	var req updateSessionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	arg := db.UpdateSessionParams{
		ID:         id,
		Name:       strings.TrimSpace(req.Name),
		StartDate:  pgtype.Timestamptz{Time: startDate, Valid: true},
		EndDate:    pgtype.Timestamptz{Time: endDate, Valid: true},
		IsActive:   req.IsActive,
		IsArchived: req.IsArchived,
	}

	session, err := server.store.UpdateSession(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, session)
}

func (server *Server) deleteSession(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	err = server.store.DeleteSession(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "session deleted"})
}
