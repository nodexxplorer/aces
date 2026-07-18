package api

import (
	"net/http"

	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createSessionRequest struct {
	Name           string `json:"name" binding:"required"`
	StartDate      string `json:"start_date"`
	EndDate        string `json:"end_date"`
	StartDateCamel string `json:"startDate"`
	EndDateCamel   string `json:"endDate"`
}

func (server *Server) createSession(ctx *gin.Context) {
	var req createSessionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startDate := req.StartDate
	if startDate == "" {
		startDate = req.StartDateCamel
	}
	endDate := req.EndDate
	if endDate == "" {
		endDate = req.EndDateCamel
	}

	if startDate == "" || endDate == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "start_date/startDate and end_date/endDate are required"})
		return
	}

	session, err := server.sessions.Create(ctx, req.Name, startDate, endDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, session)
}

func (server *Server) getSession(ctx *gin.Context) {
	idStr := ctx.Param("id")

	session, err := server.sessions.GetByIDOrActive(ctx, idStr)
	if err != nil {
		status := http.StatusNotFound
		if err.Error() == "invalid session id" {
			status = http.StatusBadRequest
		}
		ctx.JSON(status, gin.H{"error": err.Error()})
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

	sessions, err := server.sessions.List(ctx, req.PageSize, (req.PageID-1)*req.PageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, sessions)
}

type updateSessionRequest struct {
	Name            string `json:"name"`
	StartDate       string `json:"start_date"`
	EndDate         string `json:"end_date"`
	StartDateCamel  string `json:"startDate"`
	EndDateCamel    string `json:"endDate"`
	IsActive        *bool  `json:"is_active"`
	IsActiveCamel   *bool  `json:"isActive"`
	IsArchived      *bool  `json:"is_archived"`
	IsArchivedCamel *bool  `json:"isArchived"`
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

	startDate := req.StartDate
	if startDate == "" {
		startDate = req.StartDateCamel
	}
	endDate := req.EndDate
	if endDate == "" {
		endDate = req.EndDateCamel
	}

	isActive := req.IsActive
	if isActive == nil {
		isActive = req.IsActiveCamel
	}
	isArchived := req.IsArchived
	if isArchived == nil {
		isArchived = req.IsArchivedCamel
	}

	session, err := server.sessions.Update(ctx, id, service.UpdateSessionInput{
		Name:       req.Name,
		StartDate:  startDate,
		EndDate:    endDate,
		IsActive:   isActive,
		IsArchived: isArchived,
	})
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	err = server.sessions.Delete(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "session deleted"})
}
