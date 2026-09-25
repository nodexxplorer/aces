package api

import (
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// ─── Graduation path (500L) ──────────────────────────────────────────────
// Final-year students don't pay the regular dues cycle: their level dues
// never gate them (see effectiveUnpaidDues), and instead they pay a one-off
// course-form-signing fee (admin-editable) whose payment unlocks CRF
// signing. The fee rides the generic payment pipeline (Paystack checkout →
// webhook/redirect confirm), same as CRF backlog.

// getGraduationFee GET /graduation/fee — any authenticated user, so the
// student's signing screen can show the fee before they commit to paying.
func (server *Server) getGraduationFee(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	fee, err := queries.GetGraduationFee(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, fee)
}

type updateGraduationFeeRequest struct {
	Amount float64 `json:"amount" binding:"required"`
}

// updateGraduationFee PUT /graduation/fee — hod/admin/delegated_admin.
// Only affects future graduation requests — an already-created request
// keeps the amount it was snapshotted with when the student requested it.
func (server *Server) updateGraduationFee(ctx *gin.Context) {
	var req updateGraduationFeeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil || req.Amount <= 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "amount must be a positive number"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	fee, err := queries.UpdateGraduationFee(ctx, decimal.NewFromFloat(req.Amount), getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, fee)
}

// createGraduationRequest POST /graduation/request — student, final year
// only. Creates the student's (single) graduation request plus a one-off
// payment for the current fee; the frontend then checks that payment out
// through the existing POST /payments/checkout flow, same as any other
// payment record. Idempotent: a pending request with a linked payment is
// returned as-is so a dropped checkout can be resumed; paid/cleared/waived
// requests conflict.
func (server *Server) createGraduationRequest(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	student, err := server.store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "only students can request graduation signing"})
		return
	}
	if student.Level < finalYearLevel {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "the graduation path opens in final year (500 level)"})
		return
	}

	// One request per student — reuse a pending one (resume checkout),
	// refuse to stack on top of a settled one.
	if existing, err := queries.GetGraduationRequest(ctx, userID); err == nil {
		if existing.Waived {
			ctx.JSON(http.StatusConflict, gin.H{"error": "your graduation signing fee was waived — you can sign your course form", "graduation_request": existing})
			return
		}
		if existing.Status == "paid" || existing.Status == "cleared" {
			ctx.JSON(http.StatusConflict, gin.H{"error": "your graduation signing fee is already settled", "graduation_request": existing})
			return
		}
		if existing.PaymentID != nil {
			ctx.JSON(http.StatusOK, gin.H{"graduation_request": existing, "resumed": true})
			return
		}
	}

	fee, err := queries.GetGraduationFee(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	request, err := queries.CreateGraduationRequest(ctx, userID, fee.Amount, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	payment, err := server.store.CreatePayment(ctx, db.CreatePaymentParams{
		StudentID: student.ID,
		Type:      db.PaymentTypeOther,
		ItemName:  "Graduation — Course Form Signing Fee",
		Amount:    request.AmountCharged,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	request, err = queries.SetGraduationRequestPayment(ctx, request.ID, payment.ID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"graduation_request": request, "payment": payment})
}

// getMyGraduationStatus GET /graduation/mine — the student's graduation
// request, if any, so the signing screen knows whether to show the fee
// payment prompt or the signing controls.
func (server *Server) getMyGraduationStatus(ctx *gin.Context) {
	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	request, err := queries.GetGraduationRequest(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusOK, nil)
		return
	}

	ctx.JSON(http.StatusOK, request)
}

// listGraduationRequests GET /graduation/requests — staff view of every
// graduation request (student, matric, level, status, amount) so admin/HOD
// can track and clear final-year students.
func (server *Server) listGraduationRequests(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	rows, err := queries.ListGraduationRequests(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, rows)
}

type createWaivedGraduationRequestRequest struct {
	MatricNumber string `json:"matric_number" binding:"required"`
}

// createWaivedGraduationRequest POST /graduation/requests — hod/admin/
// delegated_admin. Creates a fee-waived graduation request for a final-year
// student identified by matric number — for students the department
// excuses from the fee entirely. The dues/signing exemption applies the
// moment the waived request exists; clearing it is bookkeeping.
func (server *Server) createWaivedGraduationRequest(ctx *gin.Context) {
	var req createWaivedGraduationRequestRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "matric_number is required"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	student, err := queries.GetStudentByMatric(ctx, req.MatricNumber)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no student found with that matric number"})
		return
	}

	request, err := queries.CreateWaivedGraduationRequest(ctx, student.UserID, getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, request)
}

// clearGraduationRequest POST /graduation/requests/:id/clear — hod/admin/
// delegated_admin. Terminal state for a settled (paid or waived) request.
func (server *Server) clearGraduationRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	request, err := queries.MarkGraduationRequestCleared(ctx, id, getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "request must be paid (or waived) before it can be cleared"})
		return
	}

	ctx.JSON(http.StatusOK, request)
}
