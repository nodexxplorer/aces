package api

import (
	"fmt"
	"net/http"

	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createTranscriptRequestReq struct {
	StudentID   string `json:"student_id" binding:"omitempty,uuid"`
	Purpose     string `json:"purpose"`
	Destination string `json:"destination"`
}

func (r *createTranscriptRequestReq) GetPurpose() string {
	if r.Purpose != "" {
		return r.Purpose
	}
	if r.Destination != "" {
		return r.Destination
	}
	return "Official transcript request"
}

func (server *Server) createTranscriptRequest(ctx *gin.Context) {
	var req createTranscriptRequestReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	// Students can only create transcript requests for themselves
	userID := getUserID(ctx)
	student, err := server.store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "student record not found"})
		return
	}
	studentID := student.ID

	transcriptReq, err := server.transcripts.Create(ctx, service.CreateTranscriptInput{
		StudentID: studentID,
		Purpose:   req.GetPurpose(),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": transcriptReq})
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

	if !requireOwnershipOrStaff(ctx, server.store, transcriptReq.StudentID) {
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": transcriptReq})
}

func (server *Server) listStudentTranscriptRequests(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	if !isStaffCaller(ctx) {
		callerStudentID, ok := requireOwnershipOrStaffByStudentIDParam(ctx, server.store)
		if !ok {
			return
		}
		studentID = callerStudentID
	}

	requests, err := server.transcripts.ListByStudent(ctx, studentID)
	if err != nil {
		// Fallback: the provided ID might be a user_id
		student, sErr := server.store.GetStudentByUserId(ctx, studentID)
		if sErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		requests, err = server.transcripts.ListByStudent(ctx, student.ID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": requests})
}

type listPendingTranscriptRequestsReq struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listPendingTranscriptRequests(ctx *gin.Context) {
	var req listPendingTranscriptRequestsReq
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	requests, err := server.transcripts.ListPending(ctx, req.PageSize, (req.PageID-1)*req.PageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

type updateTranscriptRequestReq struct {
	Status       string  `json:"status" binding:"required"`
	FeePaid      bool    `json:"fee_paid"`
	PdfUrl       *string `json:"pdf_url"`
	SentViaEmail bool    `json:"sent_via_email"`
}

func (server *Server) updateTranscriptRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req updateTranscriptRequestReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	// Always the caller's own ID, never client-supplied, so the audit trail
	// records who actually processed the request.
	processedByID := getUserID(ctx)
	processedBy := &processedByID

	transcriptReq, err := server.transcripts.Update(ctx, id, service.UpdateTranscriptInput{
		Status:       req.Status,
		FeePaid:      req.FeePaid,
		PdfUrl:       req.PdfUrl,
		SentViaEmail: req.SentViaEmail,
		ProcessedBy:  processedBy,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Notify the student about transcript request status change
	if student, err := server.store.GetStudent(ctx, transcriptReq.StudentID); err == nil {
		eType := "transcript_request"
		eID := transcriptReq.ID
		title := "Transcript Request Updated"
		msg := fmt.Sprintf("Your transcript request status has been updated to %s.", req.Status)
		priority := "normal"
		if req.Status == "ready" || req.Status == "completed" {
			title = "Transcript Ready"
			msg = "Your transcript request has been processed and is ready."
			priority = "high"
		} else if req.Status == "rejected" {
			title = "Transcript Request Rejected"
			msg = "Your transcript request has been rejected."
			priority = "high"
		}
		server.notifyUser(
			ctx,
			student.UserID,
			"academic",
			"system",
			priority,
			title,
			msg,
			"/transcripts",
			"View Transcripts",
			&eType,
			&eID,
		)
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "deleted successfully"})
}
