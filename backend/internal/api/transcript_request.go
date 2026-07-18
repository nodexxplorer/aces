package api

import (
	"net/http"

	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createTranscriptRequestReq struct {
	StudentID string `json:"student_id" binding:"required,uuid"`
	Purpose   string `json:"purpose" binding:"required"`
}

func (server *Server) createTranscriptRequest(ctx *gin.Context) {
	var req createTranscriptRequestReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, _ := uuid.Parse(req.StudentID)

	transcriptReq, err := server.transcripts.Create(ctx, service.CreateTranscriptInput{
		StudentID: studentID,
		Purpose:   req.Purpose,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, transcriptReq)
}

func (server *Server) getTranscriptRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	transcriptReq, err := server.transcripts.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	ctx.JSON(http.StatusOK, transcriptReq)
}

func (server *Server) listStudentTranscriptRequests(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	requests, err := server.transcripts.ListByStudent(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

type listPendingTranscriptRequestsReq struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listPendingTranscriptRequests(ctx *gin.Context) {
	var req listPendingTranscriptRequestsReq
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	requests, err := server.transcripts.ListPending(ctx, req.PageSize, (req.PageID-1)*req.PageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

type updateTranscriptRequestReq struct {
	Status      string  `json:"status" binding:"required"`
	FeePaid     bool    `json:"fee_paid"`
	PdfUrl      *string `json:"pdf_url"`
	SentViaEmail bool   `json:"sent_via_email"`
	ProcessedBy *string `json:"processed_by" binding:"omitempty,uuid"`
}

func (server *Server) updateTranscriptRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req updateTranscriptRequestReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var processedBy *uuid.UUID
	if req.ProcessedBy != nil {
		id, _ := uuid.Parse(*req.ProcessedBy)
		processedBy = &id
	}

	transcriptReq, err := server.transcripts.Update(ctx, id, service.UpdateTranscriptInput{
		Status:       req.Status,
		FeePaid:      req.FeePaid,
		PdfUrl:       req.PdfUrl,
		SentViaEmail: req.SentViaEmail,
		ProcessedBy:  processedBy,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, transcriptReq)
}

func (server *Server) deleteTranscriptRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := server.transcripts.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "deleted successfully"})
}
