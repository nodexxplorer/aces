package api

import (
	"net/http"
	"time"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createProfileUpdateRequestReq struct {
	StudentID string  `json:"student_id" binding:"required,uuid"`
	FieldName string  `json:"field_name" binding:"required"`
	OldValue  *string `json:"old_value"`
	NewValue  string  `json:"new_value" binding:"required"`
}

func (server *Server) createProfileUpdateRequest(ctx *gin.Context) {
	var req createProfileUpdateRequestReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, _ := uuid.Parse(req.StudentID)

	arg := db.CreateProfileUpdateRequestParams{
		StudentID: studentID,
		FieldName: req.FieldName,
		OldValue:  req.OldValue,
		NewValue:  req.NewValue,
		Status:    "pending",
	}

	request, err := server.store.CreateProfileUpdateRequest(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, request)
}

func (server *Server) getProfileUpdateRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	request, err := server.store.GetProfileUpdateRequest(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	ctx.JSON(http.StatusOK, request)
}

func (server *Server) listStudentProfileUpdateRequests(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	requests, err := server.store.ListStudentProfileUpdateRequests(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

type listPendingProfileUpdateRequestsReq struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listPendingProfileUpdateRequests(ctx *gin.Context) {
	var req listPendingProfileUpdateRequestsReq
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.ListPendingProfileUpdateRequestsParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	requests, err := server.store.ListPendingProfileUpdateRequests(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

type updateProfileUpdateRequestStatusReq struct {
	Status          string  `json:"status" binding:"required"`
	ApprovedBy      *string `json:"approved_by" binding:"omitempty,uuid"`
	ApprovedAt      *string `json:"approved_at"`
	RejectionReason *string `json:"rejection_reason"`
}

func (server *Server) updateProfileUpdateRequestStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req updateProfileUpdateRequestStatusReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateProfileUpdateRequestStatusParams{
		ID:              id,
		Status:          req.Status,
		RejectionReason: req.RejectionReason,
	}

	if req.ApprovedBy != nil {
		approvedBy, err := uuid.Parse(*req.ApprovedBy)
		if err == nil {
			arg.ApprovedBy = pgtype.UUID{Bytes: approvedBy, Valid: true}
		}
	}

	if req.ApprovedAt != nil {
		approvedAt, err := time.Parse(time.RFC3339, *req.ApprovedAt)
		if err == nil {
			arg.ApprovedAt = pgtype.Timestamptz{Time: approvedAt, Valid: true}
		}
	}

	request, err := server.store.UpdateProfileUpdateRequestStatus(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, request)
}

func (server *Server) deleteProfileUpdateRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := server.store.DeleteProfileUpdateRequest(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "deleted successfully"})
}
