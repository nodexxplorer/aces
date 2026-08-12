package api

import (
	"database/sql"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/aces/backend/internal/auth"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ─── Student Dashboard ───────────────────────────────────────────────────────

type studentDashboardResponse struct {
	Student       *studentInfo        `json:"student"`
	Attendance    *attendanceOverview `json:"attendance"`
	Payments      *paymentSummary     `json:"payments"`
	NextClass     *nextClassInfo      `json:"next_class"`
	TodayClasses  []todayClassItem    `json:"today_classes"`
	Announcements []announcementItem  `json:"announcements"`
	RecentGrades  []recentGradeItem   `json:"recent_grades"`
	Notifications *notifSummary       `json:"notifications"`
	Carryovers    int                 `json:"carryovers"`
}

type studentInfo struct {
	FullName     string   `json:"full_name"`
	MatricNumber string   `json:"matric_number"`
	Level        int32    `json:"level"`
	CGPA         *float64 `json:"cgpa"`
	Standing     *string  `json:"academic_standing"`
}

type attendanceOverview struct {
	TotalClasses   int     `json:"total_classes"`
	Attended       int     `json:"attended"`
	AttendanceRate float64 `json:"attendance_rate"`
}

type paymentSummary struct {
	AmountPending   float64 `json:"amount_pending"`
	AmountPaid      float64 `json:"amount_paid"`
	DuesOutstanding int     `json:"dues_outstanding"`
}

type nextClassInfo struct {
	CourseCode  string  `json:"course_code"`
	CourseTitle string  `json:"course_title"`
	StartTime   string  `json:"start_time"`
	EndTime     string  `json:"end_time"`
	Venue       string  `json:"venue"`
	DayOfWeek   string  `json:"day_of_week"`
	TimeUntil   string  `json:"time_until"`
	ClassType   *string `json:"class_type"`
}

type todayClassItem struct {
	CourseCode  string  `json:"course_code"`
	CourseTitle string  `json:"course_title"`
	StartTime   string  `json:"start_time"`
	EndTime     string  `json:"end_time"`
	Venue       string  `json:"venue"`
	ClassType   *string `json:"class_type"`
}

type announcementItem struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Content  string `json:"content"`
	IsPinned bool   `json:"is_pinned"`
	Date     string `json:"date"`
}

type recentGradeItem struct {
	CourseCode  string  `json:"course_code"`
	CourseTitle string  `json:"course_title"`
	Score       float64 `json:"score"`
	Grade       *string `json:"grade"`
	SessionName string  `json:"session_name"`
	Semester    string  `json:"semester"`
}

type notifSummary struct {
	Total  int `json:"total"`
	Unread int `json:"unread"`
}

// getStudentDashboard aggregates all data for the student's main dashboard.
func (server *Server) getStudentDashboard(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// 1. Get student record + user
	student, err := queries.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "student record not found"})
		return
	}

	user, err := queries.GetUser(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	level := student.Level
	var cgpaFloat *float64
	if student.Cgpa.Valid {
		f, _ := student.Cgpa.Float64Value()
		v := f.Float64
		cgpaFloat = &v
	}
	var standing *string
	if student.AcademicStanding != nil {
		s := string(*student.AcademicStanding)
		standing = &s
	}
	resp := studentDashboardResponse{
		Student: &studentInfo{
			FullName:     user.FullName,
			MatricNumber: student.MatricNumber,
			Level:        level,
			CGPA:         cgpaFloat,
			Standing:     standing,
		},
	}

	// 2. Attendance overview — sourced from the QR check-in system
	// (attendance_sessions/attendance_checkins), the same tables the class
	// rep's session flow and lecturer review queue use. This used to read
	// attendance_sheets, a table nothing in the app ever writes to (its only
	// writer, createAttendanceSheet, is registered but never called from any
	// frontend page), so the summary always showed 0/0 no matter how many
	// times a student actually checked in.
	if activeSem, err := queries.GetActiveSemester(ctx); err == nil {
		summary, err := queries.GetStudentAttendanceSummary(ctx, student.ID, userID, activeSem.ID)
		if err == nil {
			rate := 0.0
			if summary.TotalClasses > 0 {
				rate = float64(summary.Attended) / float64(summary.TotalClasses) * 100
			}
			resp.Attendance = &attendanceOverview{
				TotalClasses:   int(summary.TotalClasses),
				Attended:       int(summary.Attended),
				AttendanceRate: rate,
			}
		}
	}

	if resp.Attendance == nil {
		resp.Attendance = &attendanceOverview{}
	}

	// 3. Payment summary
	paySummary, err := queries.GetStudentPaymentSummary(ctx, student.ID)
	if err == nil {
		resp.Payments = &paymentSummary{
			AmountPending: paySummary.AmountPending.InexactFloat64(),
			AmountPaid:    paySummary.AmountPaid.InexactFloat64(),
		}
	}

	// 4. Count unpaid dues for student's level
	dues, err := queries.ListDuesByLevel(ctx, &level)
	if err == nil && resp.Payments != nil {
		unpaidCount := 0
		for _, due := range dues {
			if due.IsActive {
				paid, _ := queries.CheckDuePaid(ctx, db.CheckDuePaidParams{
					StudentID: student.ID,
					DueID:     due.ID,
				})
				if !paid {
					unpaidCount++
				}
			}
		}
		resp.Payments.DuesOutstanding = unpaidCount
	}

	// 5. Today's timetable + next class
	entries, err := queries.ListTimetableByType(ctx, db.ListTimetableByTypeParams{
		EntryType: "class",
		Level:     &level,
	})
	if err == nil {
		now := time.Now()
		todayDow := int32(now.Weekday())
		// Convert to 1=Mon...5=Fri
		todayDow1 := todayDow
		if todayDow == 0 {
			todayDow1 = 7 // Sunday -> no match
		}

		for _, entry := range entries {
			if entry.DayOfWeek == nil || *entry.DayOfWeek != todayDow1 {
				continue
			}

			item := todayClassItem{
				CourseCode:  entry.CourseCode,
				CourseTitle: entry.CourseTitle,
				StartTime:   entry.StartTime,
				EndTime:     entry.EndTime,
				Venue:       entry.Venue,
				ClassType:   entry.ClassType,
			}
			resp.TodayClasses = append(resp.TodayClasses, item)

			// Next class detection
			if resp.NextClass == nil {
				hour, minute, ok := parseTimeStr(entry.StartTime)
				if ok {
					classTime := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
					if classTime.After(now) {
						timeUntil := classTime.Sub(now)
						var timeStr string
						if timeUntil.Hours() >= 1 {
							timeStr = fmt.Sprintf("%.0fh %dm", timeUntil.Hours(), int(timeUntil.Minutes())%60)
						} else {
							timeStr = fmt.Sprintf("%dm", int(timeUntil.Minutes()))
						}
						resp.NextClass = &nextClassInfo{
							CourseCode:  entry.CourseCode,
							CourseTitle: entry.CourseTitle,
							StartTime:   entry.StartTime,
							EndTime:     entry.EndTime,
							Venue:       entry.Venue,
							DayOfWeek:   now.Weekday().String(),
							TimeUntil:   timeStr,
							ClassType:   entry.ClassType,
						}
					}
				}
			}
		}
	}

	// 6. Announcements (last 5)
	announcements, err := queries.ListActiveAnnouncements(ctx, db.ListActiveAnnouncementsParams{
		Limit:  5,
		Offset: 0,
	})
	if err == nil {
		for _, ann := range announcements {
			resp.Announcements = append(resp.Announcements, announcementItem{
				ID:       ann.ID.String(),
				Title:    ann.Title,
				Content:  ann.Content,
				IsPinned: ann.IsPinned,
				Date:     ann.CreatedAt.Time.Format("Jan 02, 2006"),
			})
		}
	}

	// 7. Recent grades (last 5) — need to join with courses for code/title
	results, err := queries.ListStudentResults(ctx, student.ID)
	if err == nil {
		limit := 5
		if len(results) < limit {
			limit = len(results)
		}
		for _, r := range results[:limit] {
			course, cerr := queries.GetCourse(ctx, r.CourseID)
			code := ""
			title := ""
			if cerr == nil {
				code = course.Code
				title = course.Title
			}
			var gradeStr *string
			if r.Grade != nil {
				g := string(*r.Grade)
				gradeStr = &g
			}
			score := r.TotalScore.InexactFloat64()
			resp.RecentGrades = append(resp.RecentGrades, recentGradeItem{
				CourseCode:  code,
				CourseTitle: title,
				Score:       score,
				Grade:       gradeStr,
			})
		}
	}

	// 8. Notification summary
	userNotifs, err := queries.ListUserNotifications(ctx, db.ListUserNotificationsParams{
		UserID: userID,
		Limit:  100,
		Offset: 0,
	})
	if err == nil {
		unread := 0
		for _, n := range userNotifs {
			if !n.IsRead {
				unread++
			}
		}
		resp.Notifications = &notifSummary{
			Total:  len(userNotifs),
			Unread: unread,
		}
	}

	// 9. Carryover count
	carryovers, err := queries.ListStudentCarryoverCourses(ctx, student.ID)
	if err == nil {
		resp.Carryovers = len(carryovers)
	}

	ctx.JSON(http.StatusOK, resp)
}

// ─── Class Representative Management ──────────────────────────────────────────

func (server *Server) getClassRepClassList(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	type classRepStudent struct {
		ID           string `json:"id"`
		UserID       string `json:"user_id"`
		FullName     string `json:"full_name"`
		MatricNumber string `json:"matric_number"`
		Email        string `json:"email"`
		Level        int32  `json:"level"`
		IsDefaulter  bool   `json:"is_defaulter"`
	}

	level := int32(400)
	if assignment, err := queries.GetActiveClassRepAssignment(ctx, userID); err == nil {
		level = assignment.Level
	} else if student, serr := queries.GetStudentByUserId(ctx, userID); serr == nil {
		level = student.Level
	}

	students, err := queries.ListStudentsByLevel(ctx, level)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	result := []classRepStudent{}
	for _, s := range students {
		user, err := queries.GetUser(ctx, s.UserID)
		if err != nil {
			continue
		}
		result = append(result, classRepStudent{
			ID:           s.ID.String(),
			UserID:       s.UserID.String(),
			FullName:     user.FullName,
			MatricNumber: s.MatricNumber,
			Email:        user.Email,
			Level:        s.Level,
			IsDefaulter:  s.IsDefaulter,
		})
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) listClassReps(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	assignments, err := queries.ListActiveClassRepAssignments(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	type classRepInfo struct {
		ID               string `json:"id"`
		ClassRepID       string `json:"class_rep_id"`
		FullName         string `json:"full_name"`
		Level            int32  `json:"level"`
		AcademicYear     string `json:"academic_year"`
		AppointmentType  string `json:"appointment_type"`
		ConsecutiveTerms int32  `json:"consecutive_terms"`
	}

	result := []classRepInfo{}
	for _, a := range assignments {
		user, err := queries.GetUser(ctx, a.ClassRepID)
		if err != nil {
			continue
		}
		result = append(result, classRepInfo{
			ID:               a.ID.String(),
			ClassRepID:       a.ClassRepID.String(),
			FullName:         user.FullName,
			Level:            int32(a.Level),
			AcademicYear:     a.AcademicYear,
			AppointmentType:  a.AppointmentType,
			ConsecutiveTerms: int32(a.ConsecutiveTerms),
		})
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) appointClassRep(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		ClassRepID   string `json:"class_rep_id" binding:"required,uuid"`
		Level        int32  `json:"level" binding:"required"`
		AcademicYear string `json:"academic_year" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	classRepID, err := uuid.Parse(req.ClassRepID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid class_rep_id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	queries.DeactivateClassRepByLevel(ctx, db.DeactivateClassRepByLevelParams{
		Level:        int32(req.Level),
		AcademicYear: req.AcademicYear,
	})

	assignment, err := queries.CreateClassRepAssignment(ctx, db.CreateClassRepAssignmentParams{
		ClassRepID:       classRepID,
		Level:            int32(req.Level),
		AcademicYear:     req.AcademicYear,
		AppointmentType:  "direct",
		AppointedBy:      pgtype.UUID{Bytes: userID, Valid: true},
		ConsecutiveTerms: 1,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, assignment)
}

func (server *Server) deactivateClassRep(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	err = queries.DeactivateClassRepByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "class rep deactivated"})
}

// ─── Class Rep Reports ───────────────────────────────────────────────────────

func (server *Server) submitClassRepReport(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		ReportType   string `json:"report_type" binding:"required"`
		Title        string `json:"title" binding:"required"`
		Content      string `json:"content" binding:"required"`
		Level        int32  `json:"level"`
		AcademicYear string `json:"academic_year"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	report, err := queries.CreateClassRepReport(ctx, db.CreateClassRepReportParams{
		ClassRepID:   userID,
		ReportType:   req.ReportType,
		Title:        req.Title,
		Content:      req.Content,
		Level:        int32Ptr(int32(req.Level)),
		AcademicYear: strPtr(req.AcademicYear),
		Status:       "submitted",
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, report)
}

func (server *Server) listClassRepReports(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	reports, err := queries.ListClassRepReportsByRep(ctx, db.ListClassRepReportsByRepParams{
		ClassRepID: userID,
		Column2:    ctx.Query("status"),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, reports)
}

func (server *Server) listAllClassRepReports(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	reports, err := queries.ListAllClassRepReports(ctx, ctx.Query("status"))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, reports)
}

func (server *Server) updateClassRepReportStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid report id"})
		return
	}

	userID := getUserID(ctx)
	var req struct {
		Status      string `json:"status" binding:"required"`
		ReviewNotes string `json:"review_notes"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	report, err := queries.UpdateClassRepReportStatus(ctx, db.UpdateClassRepReportStatusParams{
		ID:          id,
		Status:      req.Status,
		ReviewedBy:  pgtype.UUID{Bytes: userID, Valid: true},
		ReviewNotes: strPtr(req.ReviewNotes),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, report)
}

// ─── Attendance Sessions ─────────────────────────────────────────────────────

// requireAttendanceSessionOwnership reports whether the caller may act on
// attendance session id — staff always may; a class rep only for a session
// they themselves created. Writes the response and returns false if not.
func requireAttendanceSessionOwnership(ctx *gin.Context, queries *db.Queries, id uuid.UUID) bool {
	if isStaffCaller(ctx) {
		return true
	}
	session, err := queries.GetAttendanceSession(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return false
	}
	if session.ClassRepID != getUserID(ctx) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you can only manage your own attendance sessions"})
		return false
	}
	return true
}

func (server *Server) createAttendanceSession(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		CourseID string `json:"course_id" binding:"required,uuid"`
		Method   string `json:"method" binding:"required"`
		Venue    string `json:"venue"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if !isStaffCaller(ctx) {
		course, cerr := queries.GetCourse(ctx, courseID)
		if cerr != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
			return
		}
		assignment, aerr := queries.GetActiveClassRepAssignment(ctx, userID)
		if aerr != nil || assignment.Level != course.Level {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "you may only open sessions for your own class level"})
			return
		}
	}

	session, err := queries.CreateAttendanceSession(ctx, db.CreateAttendanceSessionParams{
		CourseID:   courseID,
		ClassRepID: userID,
		Method:     req.Method,
		Venue:      strPtr(req.Venue),
		Status:     "draft",
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, session)
}

func (server *Server) openAttendanceSession(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if !requireAttendanceSessionOwnership(ctx, queries, id) {
		return
	}

	session, err := queries.UpdateAttendanceSessionStatus(ctx, db.UpdateAttendanceSessionStatusParams{
		Status: "open",
		ID:     id,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open session: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, session)
}

func (server *Server) closeAttendanceSession(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if !requireAttendanceSessionOwnership(ctx, queries, id) {
		return
	}

	session, err := queries.UpdateAttendanceSessionStatus(ctx, db.UpdateAttendanceSessionStatusParams{
		Status: "closed",
		ID:     id,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, session)
}

func (server *Server) checkInStudent(ctx *gin.Context) {
	var req struct {
		SessionID string `json:"session_id" binding:"required,uuid"`
		StudentID string `json:"student_id"`
		Method    string `json:"method"`
		Present   *bool  `json:"present"`
		Remark    string `json:"remark"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// A student caller (as opposed to a class rep/staff marking a roster) may
	// only ever check themselves in — their student_id is always derived from
	// their own session, never trusted from the request body.
	//
	// attendance_checkins.student_id has an FK to users(id) (confirmed against
	// the live schema, and matches how ListAttendanceSessionCheckins joins
	// back to users), despite the column name — it must hold the user's ID,
	// not students.id. getStudentIDFromUser returns students.id, so using it
	// here violated the FK on every single check-in (self and roster alike).
	var studentID uuid.UUID
	isSelfCheckIn := false
	if claimsVal, exists := ctx.Get("claims"); exists {
		if claims, ok := claimsVal.(*auth.Claims); ok &&
			claims.HasRole("student") &&
			!claims.HasAnyRole([]string{"class_rep", "hod", "admin", "delegated_admin"}) {
			isSelfCheckIn = true
			if _, err := server.getStudentIDFromUser(ctx); err != nil {
				ctx.JSON(http.StatusForbidden, gin.H{"error": "student profile not found"})
				return
			}
			studentID = userID
		}
	}
	if !isSelfCheckIn {
		studentID, err = uuid.Parse(req.StudentID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
			return
		}
	}

	method := req.Method
	if method == "" {
		method = "manual"
	}
	present := true
	if req.Present != nil {
		present = *req.Present
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	checkin, err := queries.CheckInStudent(ctx, db.CheckInStudentParams{
		SessionID: sessionID,
		StudentID: studentID,
		Method:    method,
		Present:   present,
		Remark:    strPtr(req.Remark),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	queries.UpdateAttendanceSessionCounts(ctx, sessionID)

	ctx.JSON(http.StatusCreated, checkin)
}

func (server *Server) listAttendanceSessionCheckins(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if !requireAttendanceSessionOwnership(ctx, queries, id) {
		return
	}

	checkins, err := queries.ListAttendanceSessionCheckins(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, checkins)
}

func (server *Server) listMyAttendanceSessions(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	sessions, err := queries.ListAttendanceSessionsByRep(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, sessions)
}

// ─── Performance Reviews ─────────────────────────────────────────────────────

func (server *Server) createPerformanceReview(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		ClassRepID          string  `json:"class_rep_id" binding:"required,uuid"`
		AcademicYear        string  `json:"academic_year" binding:"required"`
		Term                string  `json:"term" binding:"required"`
		AttendanceRate      float64 `json:"attendance_rate"`
		ReportsSubmitted    int32   `json:"reports_submitted"`
		ResponsivenessScore *int32  `json:"responsiveness_score"`
		Comments            string  `json:"comments"`
		Rating              string  `json:"rating"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	classRepID, err := uuid.Parse(req.ClassRepID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid class_rep_id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	review, err := queries.CreateClassRepPerformanceReview(ctx, db.CreateClassRepPerformanceReviewParams{
		ClassRepID:          classRepID,
		ReviewedBy:          userID,
		AcademicYear:        req.AcademicYear,
		Term:                req.Term,
		AttendanceRate:      pgtype.Numeric{Int: big.NewInt(int64(req.AttendanceRate * 100)), Exp: -2, Valid: true},
		ReportsSubmitted:    req.ReportsSubmitted,
		ResponsivenessScore: req.ResponsivenessScore,
		Comments:            strPtr(req.Comments),
		Rating:              strPtr(req.Rating),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, review)
}

func (server *Server) listPerformanceReviews(ctx *gin.Context) {
	repIDStr := ctx.Query("class_rep_id")
	if repIDStr == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "class_rep_id query param required"})
		return
	}

	repID, err := uuid.Parse(repIDStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid class_rep_id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	reviews, err := queries.ListClassRepPerformanceReviews(ctx, repID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, reviews)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func nullStr(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func parseTimeStr(timeStr string) (hour, minute int, ok bool) {
	timeStr = strings.TrimSpace(timeStr)
	if strings.Contains(timeStr, " ") {
		parts := strings.Split(timeStr, " ")
		if len(parts) >= 2 {
			timeStr = parts[1]
		}
	}
	if idx := strings.Index(timeStr, "+"); idx > 0 {
		timeStr = timeStr[:idx]
	}
	tp := strings.Split(timeStr, ":")
	if len(tp) >= 2 {
		fmt.Sscanf(tp[0], "%d", &hour)
		fmt.Sscanf(tp[1], "%d", &minute)
		return hour, minute, true
	}
	return 0, 0, false
}

func parseFlexibleTime(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t, err = time.Parse("2006-01-02", s)
		if err != nil {
			return nil
		}
	}
	return &t
}

func nomStartToNullTime(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{Valid: false}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func int32Ptr(i int32) *int32 {
	return &i
}

// listPendingCourseRegistrations GET /class-rep/pending-registrations
// Scoped to exactly what the "Course Forms" tab shows and can act on:
// pending course registration forms for the class rep's level. This used to
// also merge in signup approvals and unapproved accounts under a generic
// {name, matric_number, level, type} shape, squashing three shapes into one
// and dropping the fields (student_name, courses_count, created_at) the
// frontend actually renders — hence blank names/courses, "N/A" submitted
// dates, and a level pre-multiplied by 100 showing up multiplied again on
// the frontend. Those two other item types now live in their own
// "Student Registrations" tab, see listPendingStudentRegistrations below.
func (server *Server) listPendingCourseRegistrations(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	level := int32(400)
	if assignment, err := queries.GetActiveClassRepAssignment(ctx, userID); err == nil {
		level = assignment.Level
	} else if student, serr := queries.GetStudentByUserId(ctx, userID); serr == nil {
		level = student.Level
	}

	regs, err := queries.ListPendingCourseRegistrationsByLevel(ctx, level)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, regs)
}

type pendingStudentRegistration struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	FullName     string `json:"full_name"`
	MatricNumber string `json:"matric_number"`
	Email        string `json:"email"`
	Level        int32  `json:"level"`
	Type         string `json:"type"` // "signup" | "account"
	CreatedAt    string `json:"created_at,omitempty"`
}

// listPendingStudentRegistrations GET /class-rep/pending-student-registrations
// New student accounts awaiting approval, scoped to the class rep's own
// level: pending signup_approvals rows (type=student) plus any unapproved
// `users` rows that never got a signup_approvals record (e.g. imported
// directly by admin). Kept separate from listPendingCourseRegistrations —
// different data, different approve action (approveStudentRegistration),
// different permission story.
func (server *Server) listPendingStudentRegistrations(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	level := int32(400)
	if assignment, err := queries.GetActiveClassRepAssignment(ctx, userID); err == nil {
		level = assignment.Level
	} else if student, serr := queries.GetStudentByUserId(ctx, userID); serr == nil {
		level = student.Level
	}

	items := []pendingStudentRegistration{}
	seen := map[string]bool{}

	approvals, err := queries.ListPendingSignupApprovalsByType(ctx, "student")
	if err == nil {
		for _, app := range approvals {
			if app.Level == nil || *app.Level != level {
				continue
			}
			user, uerr := queries.GetUser(ctx, app.UserID)
			if uerr != nil {
				continue
			}
			regNo := ""
			if app.RegNo != nil {
				regNo = *app.RegNo
			}
			items = append(items, pendingStudentRegistration{
				ID:           app.ID.String(),
				UserID:       app.UserID.String(),
				FullName:     user.FullName,
				MatricNumber: regNo,
				Email:        user.Email,
				Level:        level,
				Type:         "signup",
				CreatedAt:    app.CreatedAt.Time.Format(time.RFC3339),
			})
			seen[app.UserID.String()] = true
		}
	}

	students, serr := queries.ListStudentsByLevel(ctx, level)
	if serr == nil {
		for _, s := range students {
			if seen[s.UserID.String()] {
				continue
			}
			user, uerr := queries.GetUser(ctx, s.UserID)
			if uerr != nil || user.IsApproved {
				continue
			}
			items = append(items, pendingStudentRegistration{
				ID:           user.ID.String(),
				UserID:       user.ID.String(),
				FullName:     user.FullName,
				MatricNumber: s.MatricNumber,
				Email:        user.Email,
				Level:        level,
				Type:         "account",
				CreatedAt:    user.CreatedAt.Time.Format(time.RFC3339),
			})
		}
	}

	ctx.JSON(http.StatusOK, items)
}

// approveStudentRegistration POST /class-rep/pending-student-registrations/:id/approve
// A level-scoped variant of approveSignup (approval.go): a class rep may
// approve a pending account, but only a *student* signup in their *own*
// level — anything else (lecturer/hod signups, another level's students) is
// rejected before touching the record. /approvals/:id/approve itself stays
// hod/admin-only and unscoped; this is a deliberately narrower door.
func (server *Server) approveStudentRegistration(ctx *gin.Context) {
	repUserID := getUserID(ctx)
	if repUserID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	repLevel := int32(400)
	if assignment, aerr := queries.GetActiveClassRepAssignment(ctx, repUserID); aerr == nil {
		repLevel = assignment.Level
	} else if student, serr := queries.GetStudentByUserId(ctx, repUserID); serr == nil {
		repLevel = student.Level
	}

	now := time.Now()

	// Resolve the target: a signup_approvals row (by its own id or by
	// user_id) or, failing that, a raw unapproved `users` row.
	approval, aerr := queries.GetSignupApprovalByUserId(ctx, id)
	if aerr != nil {
		approval, aerr = queries.GetSignupApproval(ctx, id)
	}

	var targetUserID uuid.UUID
	if aerr == nil {
		if approval.SignupType != "student" {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "class reps may only approve student registrations"})
			return
		}
		if approval.Level == nil || *approval.Level != repLevel {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "this student is not in your class level"})
			return
		}
		targetUserID = approval.UserID
	} else {
		targetUserID = id
		student, serr := queries.GetStudentByUserId(ctx, targetUserID)
		if serr != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "registration not found"})
			return
		}
		if student.Level != repLevel {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "this student is not in your class level"})
			return
		}
	}

	if aerr == nil {
		if _, uerr := queries.UpdateSignupApproval(ctx, db.UpdateSignupApprovalParams{
			ID:         approval.ID,
			Status:     "approved",
			ApprovedBy: pgtype.UUID{Bytes: repUserID, Valid: true},
			ApprovedAt: pgtype.Timestamptz{Time: now, Valid: true},
		}); uerr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	}

	if _, uerr := queries.ApproveUserStatus(ctx, db.ApproveUserStatusParams{
		ID:         targetUserID,
		IsApproved: true,
		ApprovedBy: pgtype.UUID{Bytes: repUserID, Valid: true},
		ApprovedAt: pgtype.Timestamptz{Time: now, Valid: true},
	}); uerr != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	server.notifyUser(
		ctx,
		targetUserID,
		"general",
		"system",
		"high",
		"Account Approved",
		"Your account has been approved! You now have full access to ACES Zone.",
		"/dashboard",
		"Go to Dashboard",
		nil,
		nil,
	)

	ctx.JSON(http.StatusOK, gin.H{"message": "student registration approved"})
}
