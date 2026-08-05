package api

import (
	"database/sql"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

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

	// 2. Attendance overview
	if student.CurrentSessionID.Valid {
		sessionUUID := uuid.UUID(student.CurrentSessionID.Bytes)
		attendanceSheets, err := queries.ListStudentAttendance(ctx, db.ListStudentAttendanceParams{
			SessionID: sessionUUID,
			Column2:   userID.String(),
		})
		if err == nil {
			totalClasses := 0
			attended := 0
			for _, sheet := range attendanceSheets {
				if sheet.Status == "finalized" {
					totalClasses++
					data := sheet.AttendanceData
					if data != nil {
						dataStr := string(data)
						if strings.Contains(dataStr, userID.String()) {
							attended++
						}
					}
				}
			}
			rate := 0.0
			if totalClasses > 0 {
				rate = float64(attended) / float64(totalClasses) * 100
			}
			resp.Attendance = &attendanceOverview{
				TotalClasses:   totalClasses,
				Attended:       attended,
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
		StudentID string `json:"student_id" binding:"required,uuid"`
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

	studentID, err := uuid.Parse(req.StudentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
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

	type pendingStudentItem struct {
		ID           string `json:"id"`
		UserID       string `json:"user_id"`
		Name         string `json:"name"`
		MatricNumber string `json:"matric_number"`
		Email        string `json:"email"`
		Level        int32  `json:"level"`
		Type         string `json:"type"`
	}

	items := []pendingStudentItem{}

	// 1. Pending signup approvals by level
	approvals, err := queries.ListPendingSignupApprovalsByType(ctx, "student")
	if err == nil {
		for _, app := range approvals {
			if app.Level != nil && *app.Level == level {
				user, uerr := queries.GetUser(ctx, app.UserID)
				name := "Student"
				email := ""
				if uerr == nil {
					name = user.FullName
					email = user.Email
				}
				regNo := ""
				if app.RegNo != nil {
					regNo = *app.RegNo
				}
				items = append(items, pendingStudentItem{
					ID:           app.ID.String(),
					UserID:       app.UserID.String(),
					Name:         name,
					MatricNumber: regNo,
					Email:        email,
					Level:        level,
					Type:         "User Registration",
				})
			}
		}
	}

	// 2. Unapproved student accounts in `users` for this level
	students, serr := queries.ListStudentsByLevel(ctx, level)
	if serr == nil {
		for _, s := range students {
			user, uerr := queries.GetUser(ctx, s.UserID)
			if uerr == nil && !user.IsApproved {
				alreadyAdded := false
				for _, it := range items {
					if it.UserID == s.UserID.String() {
						alreadyAdded = true
						break
					}
				}
				if !alreadyAdded {
					items = append(items, pendingStudentItem{
						ID:           user.ID.String(),
						UserID:       user.ID.String(),
						Name:         user.FullName,
						MatricNumber: s.MatricNumber,
						Email:        user.Email,
						Level:        level,
						Type:         "Account Registration",
					})
				}
			}
		}
	}

	// 3. Pending course forms
	regs, rerr := queries.ListPendingCourseRegistrationsByLevel(ctx, level)
	if rerr == nil {
		for _, r := range regs {
			items = append(items, pendingStudentItem{
				ID:           r.ID.String(),
				UserID:       r.StudentID.String(),
				Name:         r.StudentName,
				MatricNumber: r.MatricNumber,
				Email:        "",
				Level:        r.Level,
				Type:         "Course Form",
			})
		}
	}

	ctx.JSON(http.StatusOK, items)
}
