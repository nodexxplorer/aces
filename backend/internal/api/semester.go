package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createSemesterRequest struct {
	SessionID            string `json:"session_id" binding:"required,uuid"`
	Name                 string `json:"name" binding:"required,oneof=first second harmattan rain First Second Harmattan Rain"`
	StartDate            string `json:"start_date" binding:"required"`
	EndDate              string `json:"end_date" binding:"required"`
	RegistrationDeadline string `json:"registration_deadline" binding:"omitempty"`
}

func (server *Server) createSemester(ctx *gin.Context) {
	var req createSemesterRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid semester data: " + err.Error()})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	name := strings.ToLower(req.Name)
	semester, err := server.semesters.Create(ctx, sessionID, name, req.StartDate, req.EndDate)
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
		ctx.JSON(status, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, semesters)
}

type updateSemesterRequest struct {
	SessionID            *string `json:"session_id"`
	Name                 *string `json:"name"`
	StartDate            *string `json:"start_date"`
	EndDate              *string `json:"end_date"`
	RegistrationDeadline *string `json:"registration_deadline"`
	IsActive             *bool   `json:"is_active"`
}

func (server *Server) updateSemester(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester id"})
		return
	}

	var req updateSemesterRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Fetch existing semester to use as defaults for unset fields
	existing, err := server.semesters.GetByIDOrActive(ctx, id.String())
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "semester not found"})
		return
	}

	// Merge: use provided values, fall back to existing values
	sessionID := existing.SessionID
	if req.SessionID != nil {
		parsed, err := uuid.Parse(*req.SessionID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
			return
		}
		sessionID = parsed
	}

	name := string(existing.Name)
	if req.Name != nil {
		name = strings.ToLower(*req.Name)
	}

	startDate := ""
	if existing.StartDate.Valid {
		startDate = existing.StartDate.Time.Format(time.RFC3339)
	}
	if req.StartDate != nil {
		startDate = *req.StartDate
	}

	endDate := ""
	if existing.EndDate.Valid {
		endDate = existing.EndDate.Time.Format(time.RFC3339)
	}
	if req.EndDate != nil {
		endDate = *req.EndDate
	}

	regDeadline := ""
	if existing.RegistrationDeadline.Valid {
		regDeadline = existing.RegistrationDeadline.Time.Format(time.RFC3339)
	}
	if req.RegistrationDeadline != nil {
		regDeadline = *req.RegistrationDeadline
	}

	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	semester, err := server.semesters.Update(ctx, id, service.UpdateSemesterInput{
		SessionID:            sessionID,
		Name:                 name,
		StartDate:            startDate,
		EndDate:              endDate,
		RegistrationDeadline: regDeadline,
		IsActive:             isActive,
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "semester deleted"})
}
