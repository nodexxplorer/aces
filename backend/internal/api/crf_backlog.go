package api

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

const maxCRFBacklogCount = 20

// getCRFBacklogPrice GET /crf-backlog/price — any authenticated user, so the
// upload screen can show the fee before the student commits to a count.
func (server *Server) getCRFBacklogPrice(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	price, err := queries.GetCRFBacklogPrice(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, price)
}

type updateCRFBacklogPriceRequest struct {
	Amount float64 `json:"amount" binding:"required"`
}

// updateCRFBacklogPrice PUT /crf-backlog/price — hod/admin/delegated_admin.
// Only affects future backlog requests — an already-created request keeps
// the amount it was snapshotted with when the student requested it.
func (server *Server) updateCRFBacklogPrice(ctx *gin.Context) {
	var req updateCRFBacklogPriceRequest
	if err := ctx.ShouldBindJSON(&req); err != nil || req.Amount <= 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "amount must be a positive number"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	price, err := queries.UpdateCRFBacklogPrice(ctx, decimal.NewFromFloat(req.Amount), getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, price)
}

type createCRFBacklogRequestRequest struct {
	Count int32 `json:"count" binding:"required"`
}

// createCRFBacklogRequest POST /crf-backlog/request — student declares how
// many old/unsigned course forms they need to submit. Creates the backlog
// batch plus a one-off payment for count * current-price; the frontend then
// checks that payment out through the existing generic
// POST /payments/:id/checkout flow, same as any other payment record.
func (server *Server) createCRFBacklogRequest(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req createCRFBacklogRequestRequest
	if err := ctx.ShouldBindJSON(&req); err != nil || req.Count <= 0 || req.Count > maxCRFBacklogCount {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "count must be between 1 and 20"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// A student with an unpaid or not-yet-fully-used batch already open
	// shouldn't be able to stack another one on top of it.
	if existing, err := queries.GetLatestCRFBacklogRequest(ctx, userID); err == nil {
		if existing.Status == "pending_payment" {
			ctx.JSON(http.StatusConflict, gin.H{"error": "you already have a backlog request awaiting payment"})
			return
		}
		if existing.Status == "paid" && existing.FormsSubmitted < existing.RequestedCount {
			ctx.JSON(http.StatusConflict, gin.H{"error": "you still have unsubmitted forms from your last backlog payment"})
			return
		}
	}

	price, err := queries.GetCRFBacklogPrice(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	amount := price.AmountPerBacklog.Mul(decimal.NewFromInt32(req.Count))

	backlog, err := queries.CreateCRFBacklogRequest(ctx, userID, req.Count, amount)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "only students can request backlog course form signing"})
		return
	}

	plural := ""
	if req.Count > 1 {
		plural = "s"
	}
	payment, err := server.store.CreatePayment(ctx, db.CreatePaymentParams{
		StudentID: studentID,
		Type:      db.PaymentTypeOther,
		ItemName:  fmt.Sprintf("Course Form Signing — Backlog (%d form%s)", req.Count, plural),
		Amount:    amount,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	backlog, err = queries.SetCRFBacklogRequestPayment(ctx, backlog.ID, payment.ID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"backlog_request": backlog, "payment": payment})
}

// getMyCRFBacklogStatus GET /crf-backlog/mine — student's most recent
// backlog batch, if any, so the upload screen knows whether to show the
// "request backlog" prompt, a "complete your payment" notice, or the upload
// control with remaining-slot count.
func (server *Server) getMyCRFBacklogStatus(ctx *gin.Context) {
	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	backlog, err := queries.GetLatestCRFBacklogRequest(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusOK, nil)
		return
	}

	ctx.JSON(http.StatusOK, backlog)
}

// submitCRFBacklogForm POST /crf-backlog/upload — student. Requires a paid
// backlog batch with remaining slots, and (unlike the normal current-semester
// upload) the student names which past semester this particular form is for,
// since nothing in the system can infer that on its own.
func (server *Server) submitCRFBacklogForm(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	semesterID, err := uuid.Parse(ctx.PostForm("semester_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "semester_id is required"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	backlog, err := queries.GetLatestCRFBacklogRequest(ctx, userID)
	if err != nil || backlog.Status != "paid" {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you need to pay for a backlog slot before uploading an old course form"})
		return
	}
	if backlog.FormsSubmitted >= backlog.RequestedCount {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you've used all the backlog slots you paid for"})
		return
	}

	activeSemester, err := server.store.GetActiveSemester(ctx)
	if err == nil && activeSemester.ID == semesterID {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "use the regular course form upload for the current semester"})
		return
	}

	if _, err := queries.GetCRFSubmissionForUserSemester(ctx, userID, semesterID); err == nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "you've already submitted a course form for that semester"})
		return
	}

	file, header, err := ctx.Request.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "course form PDF is required"})
		return
	}
	defer file.Close()

	if strings.ToLower(filepath.Ext(header.Filename)) != ".pdf" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "file must be a PDF"})
		return
	}

	pdfBytes, err := io.ReadAll(file)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	stamped, err := server.stampCRFPDF(ctx, queries, pdfBytes)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	originalPath, err := server.storage.SaveFile(header, "crf-signing/original")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	signedPath, err := server.storage.SaveBytes(stamped, "crf-signing/signed", ".pdf")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	submission, err := queries.CreateCRFSigningSubmission(ctx, userID, semesterID, originalPath, signedPath)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if _, err := queries.IncrementCRFBacklogFormsSubmitted(ctx, backlog.ID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, submission)
}
