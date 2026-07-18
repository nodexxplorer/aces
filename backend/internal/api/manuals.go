package api

import (
	"fmt"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var manualQRSecret = []byte("aces-manual-qr-secret-change-in-prod-2026")

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
	ManualID string `json:"manual_id" binding:"required"`
}

type addToPrintQueueRequest struct {
	PurchaseID string `json:"purchase_id" binding:"required"`
}

type updatePrintQueueRequest struct {
	Status string `json:"status" binding:"required"`
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

type printQueueResponse struct {
	ID           string  `json:"id"`
	PurchaseID   string  `json:"purchase_id"`
	StudentID    string  `json:"student_id"`
	ManualID     string  `json:"manual_id"`
	Status       string  `json:"status"`
	QueuedAt     string  `json:"queued_at"`
	PrintedAt    *string `json:"printed_at,omitempty"`
	CollectedAt  *string `json:"collected_at,omitempty"`
	ManualTitle  string  `json:"manual_title"`
	StudentName  string  `json:"student_name"`
	MatricNumber string  `json:"matric_number"`
	ProcessedBy  *string `json:"processed_by,omitempty"`
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, manual)
}

func (server *Server) listManuals(ctx *gin.Context) {
	manuals, err := server.manuals.List(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "manual deleted successfully"})
}

// ─── Purchase Manual (Student) ───

func (server *Server) purchaseManual(ctx *gin.Context) {
	var req purchaseManualRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	manualID, err := uuid.Parse(req.ManualID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid manual_id"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
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
	}, manualQRSecret)
	qrCodeImageURL, _ := utils.GenerateQRCodeImage(qrPayload)

	purchase, err := server.manuals.Purchase(ctx, db.CreateManualPurchaseParams{
		StudentID:  studentID,
		ManualID:   manualID,
		QrCodeData: &qrPayload,
		QrCodeUrl:  &qrCodeImageURL,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Auto-add to print queue
	_, _ = server.manuals.AddToPrintQueue(ctx, db.CreatePrintQueueItemParams{
		PurchaseID: purchase.ID,
		StudentID:  studentID,
		ManualID:   manualID,
	})

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
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	purchases, err := server.manuals.ListStudentPurchases(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, purchase)
}

// ─── Print Queue ───

func (server *Server) addToPrintQueue(ctx *gin.Context) {
	var req addToPrintQueueRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	purchaseID, err := uuid.Parse(req.PurchaseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase_id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// Fetch purchase to get student_id and manual_id
	purchase, err := queries.GetManualPurchase(ctx, purchaseID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "purchase not found"})
		return
	}

	queueItem, err := server.manuals.AddToPrintQueue(ctx, db.CreatePrintQueueItemParams{
		PurchaseID: purchaseID,
		StudentID:  purchase.StudentID,
		ManualID:   purchase.ManualID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, queueItem)
}

func (server *Server) listPrintQueue(ctx *gin.Context) {
	status := ctx.Query("status")
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}

	queue, err := server.manuals.ListPrintQueue(ctx, statusPtr, 200, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var result []printQueueResponse
	for _, q := range queue {
		r := printQueueResponse{
			ID:           q.ID.String(),
			PurchaseID:   q.PurchaseID.String(),
			StudentID:    q.StudentID.String(),
			ManualID:     q.ManualID.String(),
			Status:       q.Status,
			QueuedAt:     q.QueuedAt.Time.Format(time.RFC3339),
			ManualTitle:  q.ManualTitle,
			StudentName:  q.StudentName,
			MatricNumber: q.MatricNumber,
		}
		if q.PrintedAt.Valid {
			s := q.PrintedAt.Time.Format(time.RFC3339)
			r.PrintedAt = &s
		}
		if q.CollectedAt.Valid {
			s := q.CollectedAt.Time.Format(time.RFC3339)
			r.CollectedAt = &s
		}
		if q.ProcessedBy.Valid {
			s := uuid.UUID(q.ProcessedBy.Bytes).String()
			r.ProcessedBy = &s
		}
		result = append(result, r)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": result})
}

func (server *Server) updatePrintQueueStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req updatePrintQueueRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	processedBy := getUserID(ctx)
	var processedByPtr *uuid.UUID
	if processedBy != uuid.Nil {
		processedByPtr = &processedBy
	}

	queueItem, err := server.manuals.UpdatePrintQueueStatus(ctx, id, req.Status, processedByPtr)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, queueItem)
}

// ─── QR Verify (Student scans QR) ───

func (server *Server) verifyManualQR(ctx *gin.Context) {
	var req qrVerifyRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	payload, err := utils.VerifyManualQRPayload(req.QRData, manualQRSecret)
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
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	rows, err := queries.ListStudentPracticalEnrollments(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, enrollment)
}

// ─── Generate Cover PDF (Student downloads personalized cover) ───

func (server *Server) downloadManualCover(ctx *gin.Context) {
	purchaseID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase ID"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
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

	if purchase.StudentID != studentID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "not your purchase"})
		return
	}

	manual, err := queries.GetManual(ctx, purchase.ManualID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "manual not found"})
		return
	}

	student, err := queries.GetStudentByUserIDFull(ctx, getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "student profile not found"})
		return
	}

	user, err := server.users.GetByID(ctx, getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
		return
	}

	courseCode := "N/A"
	courseTitle := "N/A"
	if manual.CourseID.Valid {
		course, err := queries.GetCourse(ctx, manual.CourseID.Bytes)
		if err == nil {
			courseCode = course.Code
			courseTitle = course.Title
		}
	}

	pdfBytes, err := utils.GenerateManualCover(utils.CoverPageInput{
		StudentName:   user.FullName,
		RegNo:         student.MatricNumber,
		Department:    "Computer Engineering",
		Level:         int(manual.Level),
		CourseCode:    courseCode,
		CourseTitle:   courseTitle,
		QRCodeData:    purchase.QrCodeData,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate cover: " + err.Error()})
		return
	}

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=manual-cover-%s.pdf", purchaseID))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}


