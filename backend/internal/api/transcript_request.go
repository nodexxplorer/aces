package api

import (
	"net/http"
	"time"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

type createTranscriptRequestReq struct {
	StudentID string          `json:"student_id" binding:"required,uuid"`
	Purpose   string          `json:"purpose" binding:"required"`
	FeePaid   bool            `json:"fee_paid"`
	FeeAmount decimal.Decimal `json:"fee_amount"`
}

func (server *Server) createTranscriptRequest(ctx *gin.Context) {
	var req createTranscriptRequestReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, _ := uuid.Parse(req.StudentID)

	arg := db.CreateTranscriptRequestParams{
		StudentID: studentID,
		Purpose:   req.Purpose,
		Status:    db.TranscriptStatusRequested,
		FeePaid:   req.FeePaid,
		FeeAmount: decimalToNumeric(req.FeeAmount),
	}

	transcriptReq, err := server.store.CreateTranscriptRequest(ctx, arg)
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

	transcriptReq, err := server.store.GetTranscriptRequest(ctx, id)
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

	requests, err := server.store.ListStudentTranscriptRequests(ctx, studentID)
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

	arg := db.ListPendingTranscriptRequestsParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	requests, err := server.store.ListPendingTranscriptRequests(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

type updateTranscriptRequestReq struct {
	Status       string  `json:"status" binding:"required"`
	FeePaid      bool    `json:"fee_paid"`
	PdfUrl       *string `json:"pdf_url"`
	QrCodeUrl    *string `json:"qr_code_url"`
	SentViaEmail bool    `json:"sent_via_email"`
	EmailedAt    *string `json:"emailed_at"`
	ProcessedBy  *string `json:"processed_by" binding:"omitempty,uuid"`
	ProcessedAt  *string `json:"processed_at"`
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

	arg := db.UpdateTranscriptRequestParams{
		ID:           id,
		Status:       db.TranscriptStatus(req.Status),
		FeePaid:      req.FeePaid,
		PdfUrl:       req.PdfUrl,
		QrCodeUrl:    req.QrCodeUrl,
		SentViaEmail: req.SentViaEmail,
	}

	if req.EmailedAt != nil {
		emailedAt, err := time.Parse(time.RFC3339, *req.EmailedAt)
		if err == nil {
			arg.EmailedAt = pgtype.Timestamptz{Time: emailedAt, Valid: true}
		}
	}

	if req.ProcessedBy != nil {
		processedBy, err := uuid.Parse(*req.ProcessedBy)
		if err == nil {
			arg.ProcessedBy = pgtype.UUID{Bytes: processedBy, Valid: true}
		}
	}

	if req.ProcessedAt != nil {
		processedAt, err := time.Parse(time.RFC3339, *req.ProcessedAt)
		if err == nil {
			arg.ProcessedAt = pgtype.Timestamptz{Time: processedAt, Valid: true}
		}
	}

	transcriptReq, err := server.store.UpdateTranscriptRequest(ctx, arg)
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

	if err := server.store.DeleteTranscriptRequest(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "deleted successfully"})
}
