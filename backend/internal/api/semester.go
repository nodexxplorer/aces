package api

import (
	"net/http"

	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

	semester, err := server.semesters.Create(ctx, sessionID, req.Name, req.StartDate, req.EndDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, semester)
}

func (server *Server) getSemester(ctx *gin.Context) {
	idStr := ctx.Param("id")

	semester, err := server.semesters.GetByIDOrActive(ctx, idStr)
	if err != nil {
		status := http.StatusNotFound
		if err.Error() == "invalid semester id" {
			status = http.StatusBadRequest
		}
		ctx.JSON(status, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, semester)
}

func (server *Server) listSessionSemesters(ctx *gin.Context) {
	sessionID, err := uuid.Parse(ctx.Param("session_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	semesters, err := server.semesters.ListBySession(ctx, sessionID)
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
	id, err := uuid.Parse(ctx.Param("id"))
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

	semester, err := server.semesters.Update(ctx, id, service.UpdateSemesterInput{
		SessionID:            sessionID,
		Name:                 req.Name,
		StartDate:            req.StartDate,
		EndDate:              req.EndDate,
		RegistrationDeadline: req.RegistrationDeadline,
		IsActive:             req.IsActive,
	})
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, semester)
}

func (server *Server) deleteSemester(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester id"})
		return
	}

	err = server.semesters.Delete(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "semester deleted"})
}
