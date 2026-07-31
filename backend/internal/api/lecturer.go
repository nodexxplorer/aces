package api

import (
	"database/sql"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─── Lecturer Management Handlers ────────────────────────────────────────────

func (server *Server) listLecturers(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	lecturers, err := queries.ListLecturers(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, lecturers)
}

func (server *Server) getLecturerProfile(ctx *gin.Context) {
	lecturerID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturer id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	profile, err := queries.GetLecturerProfileByUserID(ctx, lecturerID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "lecturer not found"})
		return
	}

	assignments, _ := queries.ListLecturerAssignments(ctx, lecturerID)
	leaves, _ := queries.ListLeaveRequests(ctx, lecturerID)

	ctx.JSON(http.StatusOK, gin.H{
		"profile":     profile,
		"assignments": assignments,
		"leaves":      leaves,
	})
}

type updateLecturerRequest struct {
	Title          *string `json:"title"`
	FirstName      *string `json:"first_name"`
	LastName       *string `json:"last_name"`
	Rank           *string `json:"rank"`
	Specialization *string `json:"specialization"`
	Bio            *string `json:"bio"`
	OfficeLocation *string `json:"office_location"`
	OfficeHours    *string `json:"office_hours"`
}

func (server *Server) updateLecturerProfile(ctx *gin.Context) {
	lecturerID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturer id"})
		return
	}

	var req updateLecturerRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	err = queries.UpdateLecturerProfile(ctx, lecturerID, db.UpdateLecturerProfileParams{
		Title:          req.Title,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		Rank:           req.Rank,
		Specialization: req.Specialization,
		Bio:            req.Bio,
		OfficeLocation: req.OfficeLocation,
		OfficeHours:    req.OfficeHours,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "lecturer profile updated"})
}

// ─── Course Assignment Handlers ──────────────────────────────────────────────

type assignCourseRequest struct {
	LecturerID string `json:"lecturer_id" binding:"required,uuid"`
	CourseID   string `json:"course_id"   binding:"required,uuid"`
	IsPrimary  *bool  `json:"is_primary"`
}

func (server *Server) assignCourseToLecturer(ctx *gin.Context) {
	var req assignCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	lecturerID, err := uuid.Parse(req.LecturerID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturer_id"})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	assignedByID := getUserID(ctx)

	sessionID := uuid.Nil
 semester := "harmattan"

	// Try to get active session/semester
	type sessionInfo struct {
		ID       uuid.UUID `db:"id"`
		Semester string    `db:"semester"`
	}
	var si sessionInfo
	_ = queries.GetDB().QueryRow(ctx, `
		SELECT s.id, COALESCE(sem.name, 'harmattan') as semester
		FROM sessions s
		LEFT JOIN semesters sem ON sem.session_id = s.id AND sem.is_active = true
		WHERE s.is_active = true
		ORDER BY s.created_at DESC LIMIT 1
	`).Scan(&si.ID, &si.Semester)
	if si.ID != uuid.Nil {
		sessionID = si.ID
		semester = si.Semester
	}

	isPrimary := true
	if req.IsPrimary != nil {
		isPrimary = *req.IsPrimary
	}

	// Resolve actual lecturer profile ID if a user_id was passed
	actualLecturerID := lecturerID
	var profileID uuid.UUID
	errProfile := queries.GetDB().QueryRow(ctx, `SELECT id FROM lecturers WHERE id = $1 OR user_id = $1`, lecturerID).Scan(&profileID)
	if errProfile == nil {
		actualLecturerID = profileID
	}

	assignmentID, err := queries.AssignCourseToLecturer(ctx, db.AssignCourseToLecturerParams{
		LecturerID: actualLecturerID,
		CourseID:   courseID,
		SessionID:  sessionID,
		Semester:   semester,
		AssignedBy: assignedByID,
		IsPrimary:  isPrimary,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Update courses.lecturer_id with both lecturer profile ID and user_id fallback
	_, _ = queries.GetDB().Exec(ctx, `UPDATE courses SET lecturer_id = $2 WHERE id = $1`, courseID, actualLecturerID)

	ctx.JSON(http.StatusCreated, gin.H{
		"id":      assignmentID,
		"message": "course assigned to lecturer",
	})
}

func (server *Server) listLecturerAssignments(ctx *gin.Context) {
	paramID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturer id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// First try matchingParam directly
	assignments, err := queries.ListLecturerAssignments(ctx, paramID)
	if err != nil || len(assignments) == 0 {
		// Fallback 1: Lookup lecturer by user_id
		var lecturerID uuid.UUID
		errLookup := queries.GetDB().QueryRow(ctx, `SELECT id FROM lecturers WHERE user_id = $1`, paramID).Scan(&lecturerID)
		if errLookup == nil {
			if a, err2 := queries.ListLecturerAssignments(ctx, lecturerID); err2 == nil && len(a) > 0 {
				assignments = a
			}
		}
	}

	// Fallback 2: If assignments table has no records, fetch courses directly assigned to this lecturer/user
	if len(assignments) == 0 {
		type courseFallback struct {
			ID          uuid.UUID `db:"id"`
			Code        string    `db:"code"`
			Title       string    `db:"title"`
			Unit        int32     `db:"unit"`
			Level       int32     `db:"level"`
			SessionID   uuid.UUID `db:"session_id"`
			Semester    string    `db:"semester"`
		}
		rows, errFB := queries.GetDB().Query(ctx, `
			SELECT c.id, c.code, c.title, c.unit, c.level,
			       COALESCE(s.id, '00000000-0000-0000-0000-000000000000'::uuid) as session_id,
			       COALESCE(sem.name, 'harmattan') as semester
			FROM courses c
			LEFT JOIN sessions s ON s.is_active = true
			LEFT JOIN semesters sem ON sem.session_id = s.id AND sem.is_active = true
			LEFT JOIN lecturers l ON l.user_id = $1 OR l.id = $1
			WHERE c.lecturer_id = l.id OR c.lecturer_id = $1
		`, paramID)
		if errFB == nil {
			defer rows.Close()
			for rows.Next() {
				var cf courseFallback
				if errScan := rows.Scan(&cf.ID, &cf.Code, &cf.Title, &cf.Unit, &cf.Level, &cf.SessionID, &cf.Semester); errScan == nil {
					assignments = append(assignments, db.LecturerCourseAssignmentRow{
						ID:             cf.ID,
						LecturerID:     paramID,
						CourseID:       cf.ID,
						CourseCode:     cf.Code,
						CourseTitle:    cf.Title,
						CourseUnit:     cf.Unit,
						Level:          cf.Level,
						SessionID:      cf.SessionID,
						Semester:       cf.Semester,
						IsPrimary:      true,
						AssignedBy:     paramID,
						AssignedByName: "System",
					})
				}
			}
		}
	}

	ctx.JSON(http.StatusOK, assignments)
}

func (server *Server) removeCourseAssignment(ctx *gin.Context) {
	assignmentID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.RemoveCourseAssignment(ctx, assignmentID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "assignment removed"})
}

// ─── Leave Management Handlers ───────────────────────────────────────────────

type createLeaveRequest struct {
	LeaveType      string `json:"leave_type" binding:"required"`
	StartDate      string `json:"start_date" binding:"required"`
	EndDate        string `json:"end_date" binding:"required"`
	Reason         string `json:"reason" binding:"required"`
	CourseHandover string `json:"course_handover"`
}

func (server *Server) createLeaveRequestHandler(ctx *gin.Context) {
	var req createLeaveRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	lecturerID := getUserID(ctx)
	if lecturerID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if req.CourseHandover == "" {
		req.CourseHandover = "{}"
	}

	leave, err := queries.CreateLeaveRequest(ctx, db.CreateLeaveRequestParams{
		LecturerID:     lecturerID,
		LeaveType:      req.LeaveType,
		StartDate:      req.StartDate,
		EndDate:        req.EndDate,
		Reason:         req.Reason,
		CourseHandover: req.CourseHandover,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, leave)
}

func (server *Server) listMyLeaveRequests(ctx *gin.Context) {
	lecturerID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	leaves, err := queries.ListLeaveRequests(ctx, lecturerID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, leaves)
}

func (server *Server) listAllLeaveRequests(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	leaves, err := queries.ListAllLeaveRequests(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, leaves)
}

type updateLeaveStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=approved rejected cancelled"`
}

func (server *Server) updateLeaveStatusHandler(ctx *gin.Context) {
	leaveID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid leave id"})
		return
	}

	var req updateLeaveStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	actorID := getUserID(ctx)
	if err := queries.UpdateLeaveStatus(ctx, leaveID, req.Status, actorID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "leave status updated"})
}

// ─── Lecturer's Own Dashboard Stats ──────────────────────────────────────────

func (server *Server) getLecturerDashboardStats(ctx *gin.Context) {
	lecturerID := getUserID(ctx)
	if lecturerID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	assignments, _ := queries.ListLecturerAssignments(ctx, lecturerID)

	totalStudents := 0
	for _, a := range assignments {
		var count int
		_ = queries.GetDB().QueryRow(ctx, `
			SELECT COUNT(*)::int FROM registered_courses rc
			JOIN registered_courses rc2 ON rc2.registration_id = rc.registration_id
			JOIN course_registrations cr ON cr.id = rc.registration_id
			WHERE rc.course_id = $1 AND cr.status IN ('submitted', 'approved')
		`, a.CourseID).Scan(&count)
		totalStudents += count
	}

	ctx.JSON(http.StatusOK, gin.H{
		"courses_assigned":  len(assignments),
		"total_students":    totalStudents,
		"assignments":       assignments,
	})
}

// ─── Bursar Dashboard Stats ──────────────────────────────────────────────────

func (server *Server) getBursarDashboardStats(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	stats, err := queries.GetBursarDashboardStats(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	pendingPayments, _ := queries.ListPendingPayments(ctx, 50)
	recentPayments, _ := queries.ListRecentPayments(ctx, 20)

	dues, _ := queries.ListDues(ctx, db.ListDuesParams{Limit: 100, Offset: 0})

	ctx.JSON(http.StatusOK, gin.H{
		"stats":           stats,
		"pending_payments": pendingPayments,
		"recent_payments": recentPayments,
		"active_dues":     len(dues),
	})
}

// ─── Record Manual Payment (Bursar) ─────────────────────────────────────────

type recordManualPaymentRequest struct {
	StudentID     string  `json:"student_id"  binding:"required,uuid"`
	DueID         string  `json:"due_id"      binding:"required,uuid"`
	Amount        string  `json:"amount"      binding:"required"`
	BankReference string  `json:"bank_reference"`
	BankName      string  `json:"bank_name"`
	Notes         string  `json:"notes"`
}

func (server *Server) recordManualPayment(ctx *gin.Context) {
	var req recordManualPaymentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
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

	due, err := server.store.GetDue(ctx, dueID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "due not found"})
		return
	}

	bankRef := sql.NullString{String: req.BankReference, Valid: req.BankReference != ""}
	bankName := sql.NullString{String: req.BankName, Valid: req.BankName != ""}
	notes := sql.NullString{String: req.Notes, Valid: req.Notes != ""}
	recordedBy := getUserID(ctx)

	payment, err := server.store.CreatePayment(ctx, db.CreatePaymentParams{
		StudentID:         studentID,
		DueID:             dueID,
		Type:              db.PaymentType(due.Type),
		ItemName:          due.Name,
		Amount:            due.Amount,
		PaystackReference: nil,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Update extra fields via direct exec since the model doesn't have them yet
	queries, ok := server.store.(*db.Queries)
	if ok {
		_, _ = queries.GetDB().Exec(ctx, `
			UPDATE payments SET
				payment_method = 'manual',
				bank_reference = $2,
				bank_name = $3,
				notes = $4,
				recorded_by = $5,
				verified_by = $5,
				verified_at = NOW(),
				paid_at = NOW()
			WHERE id = $1
		`, payment.ID, bankRef, bankName, notes, recordedBy)
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"id":      payment.ID,
		"message": "manual payment recorded and verified",
	})
}
