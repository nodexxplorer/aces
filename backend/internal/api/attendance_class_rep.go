package api

import (
	"fmt"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// getRegisteredStudentsForAttendance GET /attendance/registered-students/:course_id
func (server *Server) getRegisteredStudentsForAttendance(ctx *gin.Context) {
	courseID, err := uuid.Parse(ctx.Param("course_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	activeSem, err := server.store.GetActiveSemester(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "no active semester configured"})
		return
	}

	students, err := server.store.GetRegisteredStudentsForAttendance(ctx, courseID, activeSem.ID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch registered students"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"course_id":        courseID,
		"total_registered": len(students),
		"students":         students,
	})
}

type submitAttendanceSessionRequest struct {
	Action string `json:"action"` // send_to_lecturer, generate_pdf
	Notes  string `json:"notes"`
}

// submitAttendanceSession POST /attendance/sessions/:id/submit
func (server *Server) submitAttendanceSession(ctx *gin.Context) {
	sessionID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	if !requireAttendanceSessionOwnership(ctx, queries, sessionID) {
		return
	}

	var req submitAttendanceSessionRequest
	_ = ctx.ShouldBindJSON(&req)

	// Update session status to pending_lecturer_review
	updatedSession, err := server.store.UpdateAttendanceSessionStatus(ctx, db.UpdateAttendanceSessionStatusParams{
		ID:     sessionID,
		Status: "pending_lecturer_review",
	})
	if err != nil {
		// This used to report success anyway even when the status update
		// failed (e.g. the now-fixed CHECK constraint rejecting the value) —
		// the class rep saw "submitted successfully" while the session's
		// status silently never changed, so it never reached the lecturer's
		// review queue. Report the real failure instead.
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to submit attendance session: " + err.Error()})
		return
	}

	// Fetch course and class rep user details for notification trigger
	course, _ := server.store.GetCourse(ctx, updatedSession.CourseID)
	repUser, _ := server.store.GetUser(ctx, updatedSession.ClassRepID)

	if course.LecturerID.Valid {
		var lecBytes [16]byte = course.LecturerID.Bytes
		lecturerUserID := uuid.UUID(lecBytes)
		lecturerUser, err := server.store.GetUser(ctx, lecturerUserID)
		if err == nil {
			entType := "attendance_session"
			server.notifyUser(
				ctx,
				lecturerUser.ID,
				"attendance_pending_review",
				"system",
				"high",
				"Attendance Awaiting Review",
				fmt.Sprintf("%s | Submitted by Class Rep %s for review.", course.Code, repUser.FullName),
				fmt.Sprintf("/lecturer/attendance-review?session_id=%s", sessionID),
				"Review Attendance",
				&entType,
				&sessionID,
			)
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":                     "success",
		"session_id":                 sessionID,
		"attendance_status":          "pending_lecturer_review",
		"lecturer_notification_sent": true,
	})
}

// downloadAttendancePDF GET /attendance/sessions/:id/pdf
func (server *Server) downloadAttendancePDF(ctx *gin.Context) {
	sessionID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	session, err := server.store.GetAttendanceSessionDetails(ctx, sessionID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "attendance session not found"})
		return
	}

	userID := getUserID(ctx)
	isClassRep := session.ClassRepID == userID
	isLecturer := session.LecturerID != nil && *session.LecturerID == userID
	if !isStaffRole(ctx) && !isClassRep && !isLecturer {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "not authorized to download this attendance sheet"})
		return
	}

	// Fetch checkins
	checkins, err := server.store.ListAttendanceSessionCheckins(ctx, sessionID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch attendance checkins"})
		return
	}

	var records []utils.AttendancePDFRecord
	for _, c := range checkins {
		st := "absent"
		if c.Present {
			st = "present"
		}
		if c.Remark != nil && *c.Remark != "" {
			st = *c.Remark
		}
		records = append(records, utils.AttendancePDFRecord{
			MatricNumber: c.MatricNumber,
			FullName:     c.StudentName,
			Level:        int(session.Level),
			Status:       st,
		})
	}

	pdfBytes, err := utils.GenerateAttendancePDF(utils.AttendancePDFInput{
		DepartmentName: session.DepartmentName,
		CourseCode:     session.CourseCode,
		CourseTitle:    session.CourseTitle,
		ScheduledDate:  session.Date.Format("2006-01-02"),
		StartTime:      session.StartTime,
		EndTime:        session.EndTime,
		Venue:          session.Venue,
		LecturerName:   session.LecturerName,
		ClassRepName:   session.ClassRepName,
		Records:        records,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate attendance PDF"})
		return
	}

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=attendance-sheet-%s.pdf", sessionID))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// getLecturerPendingAttendanceReviews GET /lecturer/attendance/pending
func (server *Server) getLecturerPendingAttendanceReviews(ctx *gin.Context) {
	userID := getUserID(ctx)

	reviews, err := server.store.GetPendingAttendanceReviews(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch pending attendance reviews"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"reviews": reviews,
		"total":   len(reviews),
	})
}

// getLecturerAttendanceHistory GET /lecturer/attendance/history
func (server *Server) getLecturerAttendanceHistory(ctx *gin.Context) {
	userID := getUserID(ctx)

	history, err := server.store.GetLecturerAttendanceHistory(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch attendance history"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"history": history,
		"total":   len(history),
	})
}

type reviewAttendanceSessionRequest struct {
	Action  string `json:"action" binding:"required,oneof=approve request_changes reject"`
	Comment string `json:"comment"`
}

// reviewAttendanceSession POST /attendance/sessions/:id/review
func (server *Server) reviewAttendanceSession(ctx *gin.Context) {
	sessionID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	var req reviewAttendanceSessionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	if !isStaffCaller(ctx) {
		queries, ok := server.store.(*db.Queries)
		if !ok {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
			return
		}
		session, serr := queries.GetAttendanceSession(ctx, sessionID)
		if serr != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return
		}
		assigned, aerr := server.store.IsLecturerAssignedToCourse(ctx, db.IsLecturerAssignedToCourseParams{
			LecturerID: getUserID(ctx),
			CourseID:   session.CourseID,
		})
		if aerr != nil || !assigned {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to teach this course"})
			return
		}
	}

	newStatus := "approved"
	if req.Action == "request_changes" {
		newStatus = "changes_requested"
	} else if req.Action == "reject" {
		newStatus = "rejected"
	}

	if _, err := server.store.UpdateAttendanceSessionStatus(ctx, db.UpdateAttendanceSessionStatusParams{
		ID:     sessionID,
		Status: newStatus,
	}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update attendance session: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":     "success",
		"session_id": sessionID,
		"new_status": newStatus,
		"message":    fmt.Sprintf("Attendance session review completed with status: %s", newStatus),
	})
}

// getStudentAttendanceOverview GET /attendance/my-overview
// Returns the caller's overall attendance rate plus a per-course breakdown
// for every course they're registered for in the active semester.
func (server *Server) getStudentAttendanceOverview(ctx *gin.Context) {
	userID := getUserID(ctx)

	student, err := server.store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "student record not found"})
		return
	}

	activeSem, err := server.store.GetActiveSemester(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "no active semester configured"})
		return
	}

	courseRows, err := server.store.GetStudentCourseAttendanceOverview(
		ctx, student.ID, activeSem.ID, activeSem.StartDate.Time, activeSem.EndDate.Time,
	)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch attendance overview"})
		return
	}

	courses := make([]gin.H, 0, len(courseRows))
	totalSessions := int32(0)
	presentCount := int32(0)
	for _, c := range courseRows {
		rate := 0.0
		if c.TotalSessions > 0 {
			rate = float64(c.PresentCount) / float64(c.TotalSessions) * 100
		}
		courses = append(courses, gin.H{
			"course_id":       c.CourseID,
			"course_code":     c.CourseCode,
			"course_title":    c.CourseTitle,
			"total_sessions":  c.TotalSessions,
			"present":         c.PresentCount,
			"absent":          c.TotalSessions - c.PresentCount,
			"attendance_rate": rate,
		})
		totalSessions += c.TotalSessions
		presentCount += c.PresentCount
	}

	overallRate := 100.0
	if totalSessions > 0 {
		overallRate = float64(presentCount) / float64(totalSessions) * 100
	}

	ctx.JSON(http.StatusOK, gin.H{
		"summary": gin.H{
			"total_sessions":  totalSessions,
			"present":         presentCount,
			"absent":          totalSessions - presentCount,
			"attendance_rate": overallRate,
		},
		"courses":    courses,
		"student_id": student.ID,
		"semester":   activeSem,
	})
}

// getStudentCourseAttendanceDetail GET /attendance/my-courses/:course_id
// Returns the session-by-session breakdown for one course, for the caller.
func (server *Server) getStudentCourseAttendanceDetail(ctx *gin.Context) {
	courseID, err := uuid.Parse(ctx.Param("course_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	userID := getUserID(ctx)
	student, err := server.store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "student record not found"})
		return
	}

	activeSem, err := server.store.GetActiveSemester(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "no active semester configured"})
		return
	}

	// Confirm the caller is actually registered for this course this
	// semester before returning any session data for it — never trust the
	// course_id path param on its own.
	courseRows, err := server.store.GetStudentCourseAttendanceOverview(
		ctx, student.ID, activeSem.ID, activeSem.StartDate.Time, activeSem.EndDate.Time,
	)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify course registration"})
		return
	}
	registered := false
	var courseCode, courseTitle string
	for _, c := range courseRows {
		if c.CourseID == courseID {
			registered = true
			courseCode = c.CourseCode
			courseTitle = c.CourseTitle
			break
		}
	}
	if !registered {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not registered for this course this semester"})
		return
	}

	sessions, err := server.store.GetStudentCourseAttendanceSessions(
		ctx, courseID, userID, activeSem.StartDate.Time, activeSem.EndDate.Time,
	)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch attendance sessions"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"course_id":    courseID,
		"course_code":  courseCode,
		"course_title": courseTitle,
		"sessions":     sessions,
	})
}

// getLecturerCourseAttendanceOverview GET /lecturers/attendance/overview
// Returns, for every course the caller teaches, the class size, sessions
// held, and average attendance rate for the active semester.
func (server *Server) getLecturerCourseAttendanceOverview(ctx *gin.Context) {
	userID := getUserID(ctx)

	activeSem, err := server.store.GetActiveSemester(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "no active semester configured"})
		return
	}

	courses, err := server.store.GetLecturerCourseAttendanceOverview(
		ctx, userID, activeSem.ID, activeSem.StartDate.Time, activeSem.EndDate.Time,
	)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch attendance overview"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"courses":  courses,
		"semester": activeSem,
	})
}
