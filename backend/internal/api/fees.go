package api

import (
	"errors"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

// Naira fees added by the payment flows. Changing these changes what students
// are charged from that point on; payments already created keep their amount.
var (
	// crfSigningFee is paid per regular course form, before the student can sign it.
	crfSigningFee = decimal.NewFromInt(200)
	// duesCheckoutCharge is added once to each dues checkout (cart), whatever the
	// number of dues in it. Backlog forms do not use it: their fee is already in
	// the backlog price (see createCRFBacklogRequest).
	duesCheckoutCharge = decimal.NewFromInt(200)
)

// requireCRFSigningFee writes a 402 response and returns true when the form
// cannot be signed yet. Regular forms need a completed signing-fee payment
// linked to the submission. Backlog forms (semester other than the active one)
// skip the check: their fee was paid with the backlog request.
func (server *Server) requireCRFSigningFee(ctx *gin.Context, queries *db.Queries, submission db.CRFSigningSubmission) bool {
	submissionRef := pgtype.UUID{Bytes: submission.ID, Valid: true}

	fee, err := queries.GetCRFSigningFeeForSubmission(ctx, submissionRef)
	if err == nil {
		if fee.Status == "completed" {
			return false
		}
		ctx.JSON(http.StatusPaymentRequired, gin.H{
			"error":            "pay the ₦" + crfSigningFee.String() + " course form signing fee before signing",
			"requires_payment": true,
			"payment":          fee,
		})
		return true
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return true
	}

	// No fee on record. A form for a past semester can only be a backlog form.
	// If the active semester cannot be read, charge the fee (the safe default).
	if active, err := server.store.GetActiveSemester(ctx); err == nil && active.ID != submission.SemesterID {
		return false
	}

	student, err := server.store.GetStudentByUserId(ctx, submission.UserID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return true
	}
	fee, err = queries.CreateCRFSigningFeePayment(ctx, db.CreateCRFSigningFeePaymentParams{
		StudentID:       student.ID,
		Type:            db.PaymentTypeOther,
		ItemName:        "Course Form Signing Fee",
		Amount:          crfSigningFee,
		CrfSubmissionID: submissionRef,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return true
	}
	ctx.JSON(http.StatusPaymentRequired, gin.H{
		"error":            "pay the ₦" + crfSigningFee.String() + " course form signing fee before signing",
		"requires_payment": true,
		"payment":          fee,
	})
	return true
}
