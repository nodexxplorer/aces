package api

import (
	"fmt"
	"log"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/payment"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

type createManualRequest struct {
	Title         string   `json:"title" binding:"required"`
	Description   *string  `json:"description"`
	Level         int32    `json:"level" binding:"required"`
	Price         float64  `json:"price" binding:"required"`
	FileUrl       *string  `json:"file_url"`
	CoverImageUrl *string  `json:"cover_image_url"`
	CourseID      *string  `json:"course_id"`
	SessionID     *string  `json:"session_id"`
}

type updateManualRequest struct {
	Title         string   `json:"title" binding:"required"`
	Description   *string  `json:"description"`
	Level         int32    `json:"level" binding:"required"`
	Price         float64  `json:"price" binding:"required"`
	FileUrl       *string  `json:"file_url"`
	CoverImageUrl *string  `json:"cover_image_url"`
	IsActive      bool     `json:"is_active"`
}

type purchaseManualRequest struct {
	ManualID  string `json:"manual_id"  binding:"required"`
	PaymentID *string `json:"payment_id" binding:"omitempty,uuid"`
}

type qrVerifyRequest struct {
	QRData string `json:"qr_data" binding:"required"`
}

type manualPurchaseResponse struct {
	ID           string  `json:"id"`
	StudentID    string  `json:"student_id"`
	ManualID     string  `json:"manual_id"`
	ManualTitle  string  `json:"manual_title"`
	ManualLevel  int32   `json:"manual_level"`
	CourseCode   string  `json:"course_code,omitempty"`
	CourseTitle  string  `json:"course_title,omitempty"`
	Price        float64 `json:"price"`
	IsCollected  bool    `json:"is_collected"`
	CollectedAt  *string `json:"collected_at,omitempty"`
	PurchasedAt  string  `json:"purchased_at"`
	QRCodeData   *string `json:"qr_code_data,omitempty"`
	QRCodeURL    *string `json:"qr_code_url,omitempty"`
	StudentName  string  `json:"student_name,omitempty"`
	MatricNumber string  `json:"matric_number,omitempty"`
}

type practicalEnrollmentResponse struct {
	ID          string `json:"id"`
	StudentID   string `json:"student_id"`
	CourseID    string `json:"course_id"`
	CourseCode  string `json:"course_code"`
	CourseTitle string `json:"course_title"`
	EnrolledVia string `json:"enrolled_via"`
	EnrolledAt  string `json:"enrolled_at"`
}

// ─── Helper: get student ID from JWT user ───

func (server *Server) getStudentIDFromUser(ctx *gin.Context) (uuid.UUID, error) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("unauthorized")
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		return uuid.Nil, fmt.Errorf("database not available")
	}

	student, err := queries.GetStudentByUserIDFull(ctx, userID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("student record not found — only students can purchase manuals")
	}

	return student.ID, nil
}

// ─── Create Manual (Admin) ───

func (server *Server) createManual(ctx *gin.Context) {
	var req createManualRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	var courseID pgtype.UUID
	if req.CourseID != nil {
		if parsed, err := uuid.Parse(*req.CourseID); err == nil {
			courseID = pgtype.UUID{Bytes: parsed, Valid: true}
		}
	}
	var sessionID pgtype.UUID
	if req.SessionID != nil {
		if parsed, err := uuid.Parse(*req.SessionID); err == nil {
			sessionID = pgtype.UUID{Bytes: parsed, Valid: true}
		}
	}

	createdBy := getUserID(ctx)

	manual, err := server.manuals.Create(ctx, db.CreateManualParams{
		Title:         req.Title,
		Description:   req.Description,
		Level:         req.Level,
		Price:         decimalFromFloat64(req.Price),
		FileUrl:       req.FileUrl,
		CoverImageUrl: req.CoverImageUrl,
		CourseID:      courseID,
		SessionID:     sessionID,
		CreatedBy:     createdBy,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, manual)
}

func (server *Server) getManual(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	manual, err := server.manuals.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, manual)
}

func (server *Server) listManuals(ctx *gin.Context) {
	manuals, err := server.manuals.List(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": manuals})
}

func (server *Server) updateManual(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req updateManualRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	manual, err := server.manuals.Update(ctx, db.UpdateManualParams{
		ID:            id,
		Title:         req.Title,
		Description:   req.Description,
		Level:         req.Level,
		Price:         decimalFromFloat64(req.Price),
		FileUrl:       req.FileUrl,
		CoverImageUrl: req.CoverImageUrl,
		IsActive:      req.IsActive,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, manual)
}

func (server *Server) deleteManual(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	if err := server.manuals.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "manual deleted successfully"})
}

// ─── Checkout Manual (Student) ───

// createManualPayment POST /manuals/:id/checkout
// Creates a pending payment for a priced manual so it can be run through the
// existing generic /payments/checkout (Paystack) flow — purchaseManual
// requires a completed payment before it will create the purchase record,
// but until now nothing ever created that payment in the first place, so
// buying any priced manual always failed with "payment required".
func (server *Server) createManualPayment(ctx *gin.Context) {
	manualID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid manual ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	manual, err := queries.GetManual(ctx, manualID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "manual not found"})
		return
	}
	if manual.Price.IsZero() {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "this manual is free — call purchase directly, no checkout needed"})
		return
	}

	purchased, _ := queries.CheckManualPurchased(ctx, db.CheckManualPurchasedParams{
		StudentID: studentID,
		ManualID:  manualID,
	})
	if purchased {
		ctx.JSON(http.StatusConflict, gin.H{"error": "manual already purchased"})
		return
	}

	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}

	paymentRecord, err := queries.CreatePayment(ctx, db.CreatePaymentParams{
		StudentID: studentID,
		DueID:     pgtype.UUID{Valid: false},
		Type:      db.PaymentTypeManual,
		ItemName:  manual.Title,
		Amount:    manual.Price,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	reference := fmt.Sprintf("ACES-MAN-%s-%d", paymentRecord.ID.String()[:8], time.Now().Unix())
	if _, err := queries.GetDB().Exec(ctx, "UPDATE payments SET paystack_reference = $1 WHERE id = $2", reference, paymentRecord.ID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	amountKobo := manual.Price.Mul(decimal.NewFromInt(100)).IntPart()
	paystackClient := payment.NewPaystackClient(server.config.PaystackSecretKey, server.config.PaystackPublicKey)
	resp, err := paystackClient.InitializePayment(payment.InitPaymentRequest{
		Email:     req.Email,
		Amount:    amountKobo,
		Reference: reference,
		// manual_id in the callback URL is how the confirmation page knows to
		// finalize a manual purchase record (not just mark the payment
		// completed) once Paystack redirects the student back — the generic
		// /payments/checkout flow has no notion of manuals at all.
		CallbackURL: fmt.Sprintf("%s/payments/confirmation?manual_id=%s", server.config.FrontendPublicURL, manualID.String()),
		Metadata: payment.Metadata{
			"payment_id": paymentRecord.ID.String(),
			"student_id": studentID.String(),
			"manual_id":  manualID.String(),
		},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "checkout initialized",
		"data": gin.H{
			"authorization_url": resp.Data.AuthorizationURL,
			"reference":         resp.Data.Reference,
			"payment_id":        paymentRecord.ID,
		},
	})
}

// ─── Purchase Manual (Student) ───

func (server *Server) purchaseManual(ctx *gin.Context) {
	var req purchaseManualRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	manualID, err := uuid.Parse(req.ManualID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid manual_id"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// Check if already purchased
	purchased, _ := queries.CheckManualPurchased(ctx, db.CheckManualPurchasedParams{
		StudentID: studentID,
		ManualID:  manualID,
	})
	if purchased {
		ctx.JSON(http.StatusConflict, gin.H{"error": "manual already purchased"})
		return
	}

	// Verify the manual exists
	manual, err := queries.GetManual(ctx, manualID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "manual not found"})
		return
	}

	// Optional payment_id for linking to a payment record.
	var paymentIDPtr *uuid.UUID
	if req.PaymentID != nil {
		payID, err := uuid.Parse(*req.PaymentID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment_id"})
			return
		}
		paymentIDPtr = &payID
	}

	if !manual.Price.IsZero() {
		paid, err := queries.HasCompletedPaymentForManual(ctx, db.HasCompletedPaymentForManualParams{
			StudentID: studentID,
			ManualID:  manualID,
			PaymentID: paymentIDPtr,
		})
		if err != nil || !paid {
			ctx.JSON(http.StatusPaymentRequired, gin.H{"error": "payment required before purchasing this manual"})
			return
		}
	}

	// Fetch student profile for QR data
	student, err := queries.GetStudentByUserIDFull(ctx, getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch student profile"})
		return
	}

	// Generate QR payload
	userID := getUserID(ctx)
	qrPayload, _ := utils.GenerateManualQRPayload(utils.ManualQRPayloadInput{
		StudentID: studentID,
		RegNo:     student.MatricNumber,
		ManualID:  manualID,
	}, []byte(server.config.ManualQRSecret))
	qrCodeImageURL, _ := utils.GenerateQRCodeImage(qrPayload)

	var paymentID pgtype.UUID
	if paymentIDPtr != nil {
		paymentID = pgtype.UUID{Bytes: *paymentIDPtr, Valid: true}
	}

	purchase, err := server.manuals.Purchase(ctx, db.CreateManualPurchaseParams{
		StudentID:  studentID,
		ManualID:   manualID,
		PaymentID:  paymentID,
		QrCodeData: &qrPayload,
		QrCodeUrl:  &qrCodeImageURL,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Fetch user name for response
	user, _ := server.users.GetByID(ctx, userID)

	ctx.JSON(http.StatusCreated, gin.H{
		"id":             purchase.ID,
		"student_id":     studentID,
		"manual_id":      manualID,
		"qr_code_data":   qrPayload,
		"qr_code_url":    qrCodeImageURL,
		"is_collected":   purchase.IsCollected,
		"purchased_at":   purchase.PurchasedAt,
		"student_name":   user.FullName,
		"matric_number":  student.MatricNumber,
	})
}

// ─── My Purchases (Student) ───

func (server *Server) listMyPurchases(ctx *gin.Context) {
	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	purchases, err := server.manuals.ListStudentPurchases(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	type purchaseResp struct {
		ID           string  `json:"id"`
		ManualID     string  `json:"manual_id"`
		ManualTitle  string  `json:"manual_title"`
		ManualLevel  int32   `json:"manual_level"`
		Price        float64 `json:"price"`
		IsCollected  bool    `json:"is_collected"`
		CollectedAt  *string `json:"collected_at"`
		PurchasedAt  string  `json:"purchased_at"`
		QRCodeData   *string `json:"qr_code_data"`
		QRCodeURL    *string `json:"qr_code_url"`
	}

	var result []purchaseResp
	for _, p := range purchases {
		r := purchaseResp{
			ID:          p.ID.String(),
			ManualID:    p.ManualID.String(),
			ManualTitle: p.Title,
			ManualLevel: p.Level,
			Price:       p.Price.InexactFloat64(),
			IsCollected: p.IsCollected,
			PurchasedAt: p.PurchasedAt.Time.Format(time.RFC3339),
			QRCodeData:  p.QrCodeData,
			QRCodeURL:   p.QrCodeUrl,
		}
		if p.CollectedAt.Valid {
			s := p.CollectedAt.Time.Format(time.RFC3339)
			r.CollectedAt = &s
		}
		result = append(result, r)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": result})
}

// ─── List Purchases by Manual (Admin) ───

func (server *Server) listManualPurchasesByManual(ctx *gin.Context) {
	manualID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid manual ID"})
		return
	}

	purchases, err := server.manuals.ListPurchasesByManual(ctx, manualID, 200, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": purchases})
}

// ─── Mark Manual Collected (Admin) ───

func (server *Server) markManualCollected(ctx *gin.Context) {
	purchaseID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase ID"})
		return
	}

	purchase, err := server.manuals.MarkCollected(ctx, purchaseID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, purchase)
}

// ─── QR Verify (Student scans QR) ───

func (server *Server) verifyManualQR(ctx *gin.Context) {
	var req qrVerifyRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	payload, err := utils.VerifyManualQRPayload(req.QRData, []byte(server.config.ManualQRSecret))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid_qr", "message": err.Error()})
		return
	}

	// Verify identity
	if payload.StudentID != studentID {
		ctx.JSON(http.StatusForbidden, gin.H{"success": false, "error": "identity_mismatch", "message": "This QR code was issued to a different student"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// Find purchase by student_id + manual_id
	purchases, err := server.manuals.ListStudentPurchases(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not list purchases"})
		return
	}

	var foundPurchase *db.ListStudentManualPurchasesRow
	for i := range purchases {
		if purchases[i].ManualID == payload.ManualID {
			foundPurchase = &purchases[i]
			break
		}
	}
	if foundPurchase == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "purchase_not_found", "message": "No purchase found for this manual"})
		return
	}

	if !foundPurchase.IsCollected {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "not_collected", "message": "Manual has not been collected yet"})
		return
	}

	// Fetch course details from manual
	manual, err := queries.GetManual(ctx, payload.ManualID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "manual not found"})
		return
	}

	courseID := manual.CourseID
	if !courseID.Valid {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "no_course", "message": "Manual is not linked to a course"})
		return
	}

	sessionID := manual.SessionID
	if !sessionID.Valid {
		// Use a nil UUID for session if not set
		sessionID = pgtype.UUID{Bytes: uuid.Nil, Valid: false}
	}

	enrollment, err := server.manuals.EnrollPractical(ctx, db.CreatePracticalEnrollmentParams{
		StudentID:   studentID,
		CourseID:    courseID.Bytes,
		SessionID:   uuid.UUID(sessionID.Bytes),
		EnrolledVia: "qr_scan",
	})
	if err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"success": false, "error": "already_enrolled", "message": err.Error()})
		return
	}

	course, _ := queries.GetCourse(ctx, courseID.Bytes)

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Enrolled successfully",
		"enrollment": practicalEnrollmentResponse{
			ID:          enrollment.ID.String(),
			StudentID:   enrollment.StudentID.String(),
			CourseID:    uuid.UUID(courseID.Bytes).String(),
			CourseCode:  course.Code,
			CourseTitle: course.Title,
			EnrolledVia: enrollment.EnrolledVia,
			EnrolledAt:  enrollment.EnrolledAt.Time.Format(time.RFC3339),
		},
	})
}

// ─── List Practical Enrollments (Student) ───

func (server *Server) listMyPracticalEnrollments(ctx *gin.Context) {
	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	rows, err := queries.ListStudentPracticalEnrollments(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var result []practicalEnrollmentResponse
	for _, r := range rows {
		result = append(result, practicalEnrollmentResponse{
			ID:          r.ID.String(),
			StudentID:   r.StudentID.String(),
			CourseID:    r.CourseID.String(),
			CourseCode:  r.CourseCode,
			CourseTitle: r.CourseTitle,
			EnrolledVia: r.EnrolledVia,
			EnrolledAt:  r.EnrolledAt.Time.Format(time.RFC3339),
		})
	}

	ctx.JSON(http.StatusOK, gin.H{"data": result})
}

// ─── Enroll Practical (Manual) ───

func (server *Server) enrollPractical(ctx *gin.Context) {
	var req struct {
		CourseID  string `json:"course_id" binding:"required"`
		SessionID string `json:"session_id" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	enrollment, err := server.manuals.EnrollPractical(ctx, db.CreatePracticalEnrollmentParams{
		StudentID:   studentID,
		CourseID:    courseID,
		SessionID:   sessionID,
		EnrolledVia: "manual",
	})
	if err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, enrollment)
}

// ─── Generate Cover PDF (Student downloads personalized cover, Admin can also download) ───

// buildCoverInputForPurchase resolves everything GenerateManualCover needs
// (student, course, session) for one manual purchase. Shared by the
// single-purchase and bulk-download handlers so the two can't drift.
func (server *Server) buildCoverInputForPurchase(ctx *gin.Context, queries *db.Queries, studentID, manualID uuid.UUID, qrCodeData *string) (utils.CoverPageInput, error) {
	manual, err := queries.GetManual(ctx, manualID)
	if err != nil {
		return utils.CoverPageInput{}, fmt.Errorf("manual not found: %w", err)
	}

	student, err := queries.GetStudent(ctx, studentID)
	if err != nil {
		return utils.CoverPageInput{}, fmt.Errorf("student profile not found: %w", err)
	}

	user, err := server.users.GetByID(ctx, student.UserID)
	if err != nil {
		return utils.CoverPageInput{}, fmt.Errorf("user not found: %w", err)
	}

	courseCode := "N/A"
	courseTitle := "N/A"
	if manual.CourseID.Valid {
		if course, err := queries.GetCourse(ctx, manual.CourseID.Bytes); err == nil {
			courseCode = course.Code
			courseTitle = course.Title
		}
	}

	sessionName := "2025/2026"
	semesterName := "Second Semester"
	if manual.SessionID.Valid {
		if sess, err := queries.GetSession(ctx, uuid.UUID(manual.SessionID.Bytes)); err == nil {
			sessionName = sess.Name
		}
	}

	return utils.CoverPageInput{
		StudentName: user.FullName,
		RegNo:       student.MatricNumber,
		Department:  "Computer Engineering",
		Level:       int(manual.Level),
		CourseCode:  courseCode,
		CourseTitle: courseTitle,
		Session:     sessionName,
		Semester:    semesterName,
		QRCodeData:  qrCodeData,
	}, nil
}

// downloadManualReceipt GET /manuals/purchases/:id/receipt
// Student-facing proof of purchase — deliberately separate from the cover
// page (which carries a QR code meant for admin print/collection handling,
// not something a student needs to see or print themselves).
func (server *Server) downloadManualReceipt(ctx *gin.Context) {
	purchaseID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	purchase, err := queries.GetManualPurchase(ctx, purchaseID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "purchase not found"})
		return
	}

	if !isStaffCaller(ctx) {
		studentID, err := server.getStudentIDFromUser(ctx)
		if err != nil || purchase.StudentID != studentID {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "not your purchase"})
			return
		}
	}

	manual, err := queries.GetManual(ctx, purchase.ManualID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "manual not found"})
		return
	}

	student, err := queries.GetStudent(ctx, purchase.StudentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "student profile not found"})
		return
	}

	user, err := server.users.GetByID(ctx, student.UserID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
		return
	}

	amount := manual.Price
	reference := purchase.ID.String()
	if purchase.PaymentID.Valid {
		if p, err := queries.GetPayment(ctx, purchase.PaymentID.Bytes); err == nil {
			amount = p.Amount
			if p.PaystackReference != nil && *p.PaystackReference != "" {
				reference = *p.PaystackReference
			}
		}
	}

	date := "N/A"
	if purchase.PurchasedAt.Valid {
		date = purchase.PurchasedAt.Time.Format("2 Jan 2006")
	}

	pdfBytes, err := utils.GenerateReceipt(utils.ReceiptInput{
		StudentName: user.FullName,
		RegNo:       student.MatricNumber,
		ItemName:    manual.Title,
		Amount:      amount.StringFixed(2),
		Reference:   reference,
		Date:        date,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=receipt-%s.pdf", purchaseID))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func (server *Server) downloadManualCover(ctx *gin.Context) {
	purchaseID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	purchase, err := queries.GetManualPurchase(ctx, purchaseID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "purchase not found"})
		return
	}

	// Students can only download their own cover; staff/admin can download any.
	if !isStaffCaller(ctx) {
		studentID, err := server.getStudentIDFromUser(ctx)
		if err != nil || purchase.StudentID != studentID {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "not your purchase"})
			return
		}
	}

	input, err := server.buildCoverInputForPurchase(ctx, queries, purchase.StudentID, purchase.ManualID, purchase.QrCodeData)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	pdfBytes, err := utils.GenerateManualCover(input)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=manual-cover-%s.pdf", purchaseID))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// bulkDownloadManualCovers GET /manuals/:id/covers/bulk
// Generates one combined multi-page PDF with every purchaser's cover page
// for the given manual, so staff can print a whole class's covers in one go
// instead of downloading each purchase's cover individually.
func (server *Server) bulkDownloadManualCovers(ctx *gin.Context) {
	manualID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid manual ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	purchases, err := server.manuals.ListPurchasesByManual(ctx, manualID, 500, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Once a batch is printed those purchases flip to collected and drop out
	// of this list — the same is_collected flag the print-queue/collection
	// flow already uses — so re-running this never regenerates and hands out
	// duplicate covers for someone already printed. A purchase that needs a
	// second copy (lost cover, printer jam) is a deliberate reprint via the
	// single-purchase cover download instead, not this bulk button.
	pending := make([]db.ListManualPurchasesByManualRow, 0, len(purchases))
	for _, p := range purchases {
		if !p.IsCollected {
			pending = append(pending, p)
		}
	}
	if len(pending) == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no unprinted purchases for this manual — everyone already has a printed cover"})
		return
	}

	inputs := make([]utils.CoverPageInput, 0, len(pending))
	printed := make([]uuid.UUID, 0, len(pending))
	for _, p := range pending {
		input, err := server.buildCoverInputForPurchase(ctx, queries, p.StudentID, p.ManualID, p.QrCodeData)
		if err != nil {
			continue
		}
		inputs = append(inputs, input)
		printed = append(printed, p.ID)
	}
	if len(inputs) == 0 {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not resolve any purchase covers"})
		return
	}

	pdfBytes, err := utils.GenerateManualCoverBatch(inputs)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	for _, purchaseID := range printed {
		if _, err := queries.MarkManualCollected(ctx, purchaseID); err != nil {
			log.Printf("[bulk-cover] failed to mark purchase %s collected: %v", purchaseID, err)
		}
	}

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=manual-covers-%s.pdf", manualID))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}


