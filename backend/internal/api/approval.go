package api

import (
	"errors"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type approvalResponse struct {
	ID              string  `json:"id"`
	UserID          string  `json:"user_id"`
	SignupType      string  `json:"signup_type"`
	Status          string  `json:"status"`
	RegNo           *string `json:"reg_no,omitempty"`
	Level           *int32  `json:"level,omitempty"`
	ApprovedBy      *string `json:"approved_by,omitempty"`
	ApprovedAt      *string `json:"approved_at,omitempty"`
	RejectionReason *string `json:"rejection_reason,omitempty"`
	CreatedAt       string  `json:"created_at"`
	FullName        string  `json:"full_name"`
	Email           string  `json:"email"`
}

type rejectApprovalRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// toApprovalResponse maps a db.SignupApproval to approvalResponse
func toApprovalResponse(a db.SignupApproval) approvalResponse {
	var approvedBy *string
	if a.ApprovedBy.Valid {
		str := uuid.UUID(a.ApprovedBy.Bytes).String()
		approvedBy = &str
	}
	var approvedAt *string
	if a.ApprovedAt.Valid {
		str := a.ApprovedAt.Time.Format(time.RFC3339)
		approvedAt = &str
	}

	return approvalResponse{
		ID:              a.ID.String(),
		UserID:          a.UserID.String(),
		SignupType:      a.SignupType,
		Status:          a.Status,
		RegNo:           a.RegNo,
		Level:           a.Level,
		ApprovedBy:      approvedBy,
		ApprovedAt:      approvedAt,
		RejectionReason: a.RejectionReason,
		CreatedAt:       a.CreatedAt.Time.Format(time.RFC3339),
	}
}

// listPendingApprovals GET /approvals/pending
func (server *Server) listPendingApprovals(ctx *gin.Context) {
	signupType := ctx.Query("type")

	var approvals []db.SignupApproval
	var err error

	if signupType != "" {
		approvals, err = server.store.ListPendingSignupApprovalsByType(ctx, signupType)
	} else {
		approvals, err = server.store.ListPendingSignupApprovals(ctx)
	}

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list approvals: " + err.Error()})
		return
	}

	res := make([]approvalResponse, len(approvals))
	for i, a := range approvals {
		res[i] = toApprovalResponse(a)
		u, errUser := server.store.GetUser(ctx, a.UserID)
		if errUser == nil {
			res[i].FullName = u.FullName
			res[i].Email = u.Email
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": res})
}

// getApprovalStatus GET /approvals/status
func (server *Server) getApprovalStatus(ctx *gin.Context) {
	userID, err := server.getAuthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	approval, err := server.store.GetSignupApprovalByUserId(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// If no request exists (e.g. HOD / Admin), return approved
			ctx.JSON(http.StatusOK, gin.H{
				"status":      "approved",
				"is_approved": true,
			})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"id":               approval.ID.String(),
		"status":           approval.Status,
		"is_approved":      approval.Status == "approved",
		"rejection_reason": approval.RejectionReason,
	})
}

// approveSignup POST /approvals/:id/approve
func (server *Server) approveSignup(ctx *gin.Context) {
	adminID, err := server.getAuthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	// Try getting approval by user_id first, then fallback to approval ID
	approval, err := server.store.GetSignupApprovalByUserId(ctx, id)
	if err != nil {
		approval, err = server.store.GetSignupApproval(ctx, id)
		if err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "approval record not found"})
			return
		}
	}

	// 2. Update status of the approval request to 'approved'
	now := time.Now()
	_, err = server.store.UpdateSignupApproval(ctx, db.UpdateSignupApprovalParams{
		ID:         approval.ID,
		Status:     "approved",
		ApprovedBy: pgtype.UUID{Bytes: adminID, Valid: true},
		ApprovedAt: pgtype.Timestamptz{Time: now, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update approval request: " + err.Error()})
		return
	}

	// 3. Set the corresponding user to approved
	_, err = server.store.ApproveUserStatus(ctx, db.ApproveUserStatusParams{
		ID:         approval.UserID,
		IsApproved: true,
		ApprovedBy: pgtype.UUID{Bytes: adminID, Valid: true},
		ApprovedAt: pgtype.Timestamptz{Time: now, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user approval status: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "user registration approved successfully"})
}

// rejectSignup POST /approvals/:id/reject
func (server *Server) rejectSignup(ctx *gin.Context) {
	adminID, err := server.getAuthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req rejectApprovalRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Try getting approval by user_id first, then fallback to approval ID
	approval, err := server.store.GetSignupApprovalByUserId(ctx, id)
	if err != nil {
		approval, err = server.store.GetSignupApproval(ctx, id)
		if err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "approval record not found"})
			return
		}
	}

	// 2. Update status of the approval request to 'rejected'
	now := time.Now()
	_, err = server.store.UpdateSignupApproval(ctx, db.UpdateSignupApprovalParams{
		ID:              approval.ID,
		Status:          "rejected",
		ApprovedBy:      pgtype.UUID{Bytes: adminID, Valid: true},
		ApprovedAt:      pgtype.Timestamptz{Time: now, Valid: true},
		RejectionReason: &req.Reason,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reject request: " + err.Error()})
		return
	}

	// 3. Set user to not approved (is_approved = false)
	_, err = server.store.ApproveUserStatus(ctx, db.ApproveUserStatusParams{
		ID:         approval.UserID,
		IsApproved: false,
		ApprovedBy: pgtype.UUID{Bytes: adminID, Valid: true},
		ApprovedAt: pgtype.Timestamptz{Time: now, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user status: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "user registration rejected successfully"})
}
