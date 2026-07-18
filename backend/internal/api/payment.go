package api

import (
	"fmt"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/payment"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

// ─── Request/Response types ───────────────────────────────────────────────────

// ── Dues ──

type createDueRequest struct {
	Name        string  `json:"name"         binding:"required"`
	Description *string `json:"description"`
	Type        string  `json:"type"         binding:"required,oneof=dept_dues class_dues manual materials transcript_fee other"`
	Amount      string  `json:"amount"       binding:"required"`
	Level       *int32  `json:"level"`
	SessionID   *string `json:"session_id"   binding:"omitempty,uuid"`
	SemesterID  *string `json:"semester_id"  binding:"omitempty,uuid"`
	Deadline    *string `json:"deadline"`    // RFC3339
	CreatedBy   string  `json:"created_by"   binding:"required,uuid"`
}

type updateDueRequest struct {
	Name        string  `json:"name"         binding:"required"`
	Description *string `json:"description"`
	Type        string  `json:"type"         binding:"required,oneof=dept_dues class_dues manual materials transcript_fee other"`
	Amount      string  `json:"amount"       binding:"required"`
	Level       *int32  `json:"level"`
	Deadline    *string `json:"deadline"`    // RFC3339
	IsActive    bool    `json:"is_active"`
}

type listDuesQuery struct {
	Limit  int32 `form:"limit"  binding:"required,min=1,max=100"`
	Offset int32 `form:"offset" binding:"min=0"`
}

type listDuesByLevelQuery struct {
	Level int32 `form:"level" binding:"required"`
}

// ── Cart ──

type addToCartRequest struct {
	StudentID string `json:"student_id" binding:"required,uuid"`
	DueID     string `json:"due_id"     binding:"required,uuid"`
	Amount    string `json:"amount"     binding:"required"`
}

// ── Batches ──

type createPaymentBatchRequest struct {
	StudentID         string `json:"student_id"         binding:"required,uuid"`
	TotalAmount       string `json:"total_amount"       binding:"required"`
	PaystackReference *string `json:"paystack_reference"`
}

type listStudentBatchesQuery struct {
	Limit  int32 `form:"limit"  binding:"required,min=1,max=100"`
	Offset int32 `form:"offset" binding:"min=0"`
}

type updateBatchStatusRequest struct {
	Status     string  `json:"status"      binding:"required,oneof=pending completed failed refunded"`
	PaidAt     *string `json:"paid_at"`    // RFC3339
	ReceiptUrl *string `json:"receipt_url"`
}

// ── Payments ──

type createPaymentRequest struct {
	StudentID         string  `json:"student_id"         binding:"required,uuid"`
	BatchID           *string `json:"batch_id"           binding:"omitempty,uuid"`
	DueID             string  `json:"due_id"             binding:"required,uuid"`
	Type              string  `json:"type"               binding:"required,oneof=dept_dues class_dues manual materials transcript_fee other"`
	ItemName          string  `json:"item_name"          binding:"required"`
	Amount            string  `json:"amount"             binding:"required"`
	PaystackReference *string `json:"paystack_reference"`
}

type listStudentPaymentsQuery struct {
	Limit  int32 `form:"limit"  binding:"required,min=1,max=100"`
	Offset int32 `form:"offset" binding:"min=0"`
}

type updatePaymentStatusRequest struct {
	Status string  `json:"status" binding:"required,oneof=pending completed failed refunded"`
	PaidAt *string `json:"paid_at"` // RFC3339
}

type verifyPaymentRequest struct {
	VerifiedBy string `json:"verified_by" binding:"required,uuid"`
}

type checkDuePaidQuery struct {
	StudentID string `form:"student_id" binding:"required,uuid"`
	DueID     string `form:"due_id"     binding:"required,uuid"`
}

// ─── Dues Handlers ────────────────────────────────────────────────────────────

// createDue POST /payments/dues
func (server *Server) createDue(ctx *gin.Context) {
	var req createDueRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	amount, err := decimal.NewFromString(req.Amount)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid amount"})
		return
	}

	createdBy, err := uuid.Parse(req.CreatedBy)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid created_by"})
		return
	}

	params := db.CreateDueParams{
		Name:        req.Name,
		Description: req.Description,
		Type:        db.PaymentType(req.Type),
		Amount:      amount,
		Level:       req.Level,
		CreatedBy:   createdBy,
	}

	if req.SessionID != nil {
		sid, err := uuid.Parse(*req.SessionID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
			return
		}
		params.SessionID = pgtype.UUID{Bytes: sid, Valid: true}
	}

	if req.SemesterID != nil {
		semID, err := uuid.Parse(*req.SemesterID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester_id"})
			return
		}
		params.SemesterID = pgtype.UUID{Bytes: semID, Valid: true}
	}

	if req.Deadline != nil {
		t, err := time.Parse(time.RFC3339, *req.Deadline)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid deadline, expected RFC3339"})
			return
		}
		params.Deadline = pgtype.Timestamptz{Time: t, Valid: true}
	}

	due, err := server.store.CreateDue(ctx, params)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, due)
}

// getDue GET /payments/dues/:id
func (server *Server) getDue(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid due id"})
		return
	}

	due, err := server.store.GetDue(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "due not found"})
		return
	}

	ctx.JSON(http.StatusOK, due)
}

// listDues GET /payments/dues
func (server *Server) listDues(ctx *gin.Context) {
	var q listDuesQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dues, err := server.store.ListDues(ctx, db.ListDuesParams{
		Limit:  q.Limit,
		Offset: q.Offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, dues)
}

// listDuesByLevel GET /payments/dues/level
func (server *Server) listDuesByLevel(ctx *gin.Context) {
	var q listDuesByLevelQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dues, err := server.store.ListDuesByLevel(ctx, &q.Level)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, dues)
}

// updateDue PUT /payments/dues/:id
func (server *Server) updateDue(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid due id"})
		return
	}

	var req updateDueRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	amount, err := decimal.NewFromString(req.Amount)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid amount"})
		return
	}

	params := db.UpdateDueParams{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Type:        db.PaymentType(req.Type),
		Amount:      amount,
		Level:       req.Level,
		IsActive:    req.IsActive,
	}

	if req.Deadline != nil {
		t, err := time.Parse(time.RFC3339, *req.Deadline)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid deadline, expected RFC3339"})
			return
		}
		params.Deadline = pgtype.Timestamptz{Time: t, Valid: true}
	}

	due, err := server.store.UpdateDue(ctx, params)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, due)
}

// deleteDue DELETE /payments/dues/:id
func (server *Server) deleteDue(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid due id"})
		return
	}

	if err := server.store.DeleteDue(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "due deactivated successfully"})
}

// ─── Cart Handlers ────────────────────────────────────────────────────────────

// addToCart POST /payments/cart
func (server *Server) addToCart(ctx *gin.Context) {
	var req addToCartRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, err := uuid.Parse(req.StudentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	dueID, err := uuid.Parse(req.DueID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid due_id"})
		return
	}

	amount, err := decimal.NewFromString(req.Amount)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid amount"})
		return
	}

	item, err := server.store.AddToCart(ctx, db.AddToCartParams{
		StudentID: studentID,
		DueID:     dueID,
		Amount:    amount,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, item)
}

// listStudentCart GET /payments/cart/:student_id
func (server *Server) listStudentCart(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	items, err := server.store.ListStudentCart(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, items)
}

// removeFromCart DELETE /payments/cart/:id
func (server *Server) removeFromCart(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid cart item id"})
		return
	}

	if err := server.store.RemoveFromCart(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "item removed from cart"})
}

// clearStudentCart DELETE /payments/cart/student/:student_id
func (server *Server) clearStudentCart(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	if err := server.store.ClearStudentCart(ctx, studentID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "cart cleared successfully"})
}

// ─── Batch Handlers ───────────────────────────────────────────────────────────

// createPaymentBatch POST /payments/batches
func (server *Server) createPaymentBatch(ctx *gin.Context) {
	var req createPaymentBatchRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, err := uuid.Parse(req.StudentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	totalAmount, err := decimal.NewFromString(req.TotalAmount)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid total_amount"})
		return
	}

	batch, err := server.store.CreatePaymentBatch(ctx, db.CreatePaymentBatchParams{
		StudentID:         studentID,
		TotalAmount:       totalAmount,
		PaystackReference: req.PaystackReference,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, batch)
}

// getPaymentBatch GET /payments/batches/:id
func (server *Server) getPaymentBatch(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid batch id"})
		return
	}

	batch, err := server.store.GetPaymentBatch(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "payment batch not found"})
		return
	}

	ctx.JSON(http.StatusOK, batch)
}

// listStudentPaymentBatches GET /payments/batches/student/:student_id
func (server *Server) listStudentPaymentBatches(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	var q listStudentBatchesQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batches, err := server.store.ListStudentPaymentBatches(ctx, db.ListStudentPaymentBatchesParams{
		StudentID: studentID,
		Limit:     q.Limit,
		Offset:    q.Offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, batches)
}

// updatePaymentBatchStatus PUT /payments/batches/:id/status
func (server *Server) updatePaymentBatchStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid batch id"})
		return
	}

	var req updateBatchStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	params := db.UpdatePaymentBatchStatusParams{
		ID:         id,
		Status:     db.PaymentStatus(req.Status),
		ReceiptUrl: req.ReceiptUrl,
	}

	if req.PaidAt != nil {
		t, err := time.Parse(time.RFC3339, *req.PaidAt)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid paid_at, expected RFC3339"})
			return
		}
		params.PaidAt = pgtype.Timestamptz{Time: t, Valid: true}
	}

	batch, err := server.store.UpdatePaymentBatchStatus(ctx, params)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, batch)
}

// listBatchPayments GET /payments/batches/:id/payments
func (server *Server) listBatchPayments(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid batch id"})
		return
	}

	payments, err := server.store.ListBatchPayments(ctx, pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, payments)
}

// ─── Payment Handlers ─────────────────────────────────────────────────────────

// createPayment POST /payments
func (server *Server) createPayment(ctx *gin.Context) {
	var req createPaymentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, err := uuid.Parse(req.StudentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	dueID, err := uuid.Parse(req.DueID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid due_id"})
		return
	}

	amount, err := decimal.NewFromString(req.Amount)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid amount"})
		return
	}

	params := db.CreatePaymentParams{
		StudentID:         studentID,
		DueID:             dueID,
		Type:              db.PaymentType(req.Type),
		ItemName:          req.ItemName,
		Amount:            amount,
		PaystackReference: req.PaystackReference,
	}

	if req.BatchID != nil {
		bid, err := uuid.Parse(*req.BatchID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid batch_id"})
			return
		}
		params.BatchID = pgtype.UUID{Bytes: bid, Valid: true}
	}

	payment, err := server.store.CreatePayment(ctx, params)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, payment)
}

// getPayment GET /payments/:id
func (server *Server) getPayment(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment id"})
		return
	}

	payment, err := server.store.GetPayment(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	ctx.JSON(http.StatusOK, payment)
}

// listStudentPayments GET /payments/student/:student_id
func (server *Server) listStudentPayments(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	var q listStudentPaymentsQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	payments, err := server.store.ListStudentPayments(ctx, db.ListStudentPaymentsParams{
		StudentID: studentID,
		Limit:     q.Limit,
		Offset:    q.Offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, payments)
}

// updatePaymentStatus PUT /payments/:id/status
func (server *Server) updatePaymentStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment id"})
		return
	}

	var req updatePaymentStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	params := db.UpdatePaymentStatusParams{
		ID:     id,
		Status: db.PaymentStatus(req.Status),
	}

	if req.PaidAt != nil {
		t, err := time.Parse(time.RFC3339, *req.PaidAt)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid paid_at, expected RFC3339"})
			return
		}
		params.PaidAt = pgtype.Timestamptz{Time: t, Valid: true}
	}

	payment, err := server.store.UpdatePaymentStatus(ctx, params)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, payment)
}

// verifyPayment POST /payments/:id/verify
func (server *Server) verifyPayment(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment id"})
		return
	}

	var req verifyPaymentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	verifiedBy, err := uuid.Parse(req.VerifiedBy)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid verified_by"})
		return
	}

	payment, err := server.store.VerifyPayment(ctx, db.VerifyPaymentParams{
		ID:         id,
		VerifiedBy: pgtype.UUID{Bytes: verifiedBy, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, payment)
}

// getStudentPaymentSummary GET /payments/summary/:student_id
func (server *Server) getStudentPaymentSummary(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	summary, err := server.store.GetStudentPaymentSummary(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, summary)
}

// checkDuePaid GET /payments/check-paid
func (server *Server) checkDuePaid(ctx *gin.Context) {
	var q checkDuePaidQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, err := uuid.Parse(q.StudentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	dueID, err := uuid.Parse(q.DueID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid due_id"})
		return
	}

	isPaid, err := server.store.CheckDuePaid(ctx, db.CheckDuePaidParams{
		StudentID: studentID,
		DueID:     dueID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"student_id": q.StudentID,
		"due_id":     q.DueID,
		"is_paid":    isPaid,
	})
}

type listAllPaymentsQuery struct {
	Limit  int32 `form:"limit"  binding:"required,min=1,max=100"`
	Offset int32 `form:"offset" binding:"min=0"`
}

type getPaymentByReferenceQuery struct {
	Reference string `form:"reference" binding:"required"`
}

type checkoutRequest struct {
	PaymentID string `json:"payment_id" binding:"required,uuid"`
	Email     string `json:"email"      binding:"required,email"`
}

// initializeCheckout POST /payments/checkout
func (server *Server) initializeCheckout(ctx *gin.Context) {
	var req checkoutRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	paymentID, err := uuid.Parse(req.PaymentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment_id"})
		return
	}

	// Fetch payment
	paymentRecord, err := server.store.GetPayment(ctx, paymentID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	if paymentRecord.Status == "completed" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "payment already completed"})
		return
	}

	// Determine reference
	reference := ""
	if paymentRecord.PaystackReference != nil && *paymentRecord.PaystackReference != "" {
		reference = *paymentRecord.PaystackReference
	} else {
		reference = fmt.Sprintf("ACES-%s-%d", paymentRecord.ID.String()[:8], time.Now().Unix())
		// Update reference in DB using raw query via GetDB
		if q, ok := server.store.(interface { GetDB() db.DBTX }); ok {
			_, err = q.GetDB().Exec(ctx, "UPDATE payments SET paystack_reference = $1 WHERE id = $2", reference, paymentRecord.ID)
			if err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save reference: " + err.Error()})
				return
			}
		}
	}

	// Initialize Paystack payment
	amountKobo := paymentRecord.Amount.Mul(decimal.NewFromInt(100)).IntPart()
	paystackClient := payment.NewPaystackClient(server.config.PaystackSecretKey, server.config.PaystackPublicKey)

	paystackReq := payment.InitPaymentRequest{
		Email:       req.Email,
		Amount:      amountKobo,
		Reference:   reference,
		CallbackURL: fmt.Sprintf("%s/payments/verify", server.config.ServerAddress),
		Metadata: payment.Metadata{
			"payment_id": paymentRecord.ID.String(),
			"student_id": paymentRecord.StudentID.String(),
		},
	}

	resp, err := paystackClient.InitializePayment(paystackReq)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize paystack: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "checkout initialized",
		"data": gin.H{
			"authorization_url": resp.Data.AuthorizationURL,
			"reference":         resp.Data.Reference,
			"access_code":       resp.Data.AccessCode,
		},
	})
}

// listAllPayments GET /payments
func (server *Server) listAllPayments(ctx *gin.Context) {
	var q listAllPaymentsQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	payments, err := server.store.ListAllPayments(ctx, db.ListAllPaymentsParams{
		Limit:  q.Limit,
		Offset: q.Offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, payments)
}

// getPaymentByReference GET /payments/by-reference?reference=XXX
func (server *Server) getPaymentByReference(ctx *gin.Context) {
	var q getPaymentByReferenceQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	payment, err := server.store.GetPaymentByReference(ctx, &q.Reference)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "payment not found for this reference"})
		return
	}

	ctx.JSON(http.StatusOK, payment)
}

// listDefaulters GET /payments/defaulters
func (server *Server) listDefaulters(ctx *gin.Context) {
	defaulters, err := server.store.ListDefaultersByLevel(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, defaulters)
}

