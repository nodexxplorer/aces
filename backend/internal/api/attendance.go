package api

import (
	"encoding/json"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ─── Request/Response types ───────────────────────────────────────────────────

// AttendanceRecord is a single student's presence entry stored inside the
// attendance_data JSONB array.
// Example: { "student_id": "<uuid>", "present": true, "remark": "late" }
type AttendanceRecord struct {
	StudentID string `json:"student_id"`
	Present   bool   `json:"present"`
	Remark    string `json:"remark,omitempty"`
}

type createAttendanceSheetRequest struct {
	CourseID       string             `json:"course_id"      binding:"required,uuid"`
	Date           string             `json:"date"           binding:"required"` // RFC3339
	ClassRepID     string             `json:"class_rep_id"   binding:"required,uuid"`
	SessionID      string             `json:"session_id"     binding:"required,uuid"`
	AttendanceData []AttendanceRecord `json:"attendance_data"`
}

type updateAttendanceSheetRequest struct {
	AttendanceData    []AttendanceRecord `json:"attendance_data"`
	Status            string             `json:"status"               binding:"omitempty,oneof=draft finalized"`
	PdfUrl            *string            `json:"pdf_url"`
	EmailedToLecturer bool               `json:"emailed_to_lecturer"`
}

type listCourseAttendanceQuery struct {
	CourseID  string `form:"course_id"  binding:"required,uuid"`
	SessionID string `form:"session_id" binding:"required,uuid"`
	Limit     int32  `form:"limit"      binding:"required,min=1,max=100"`
	Offset    int32  `form:"offset"     binding:"min=0"`
}

type listStudentAttendanceQuery struct {
	SessionID string `form:"session_id" binding:"required,uuid"`
	StudentID string `form:"student_id" binding:"required,uuid"`
}

type attendanceSummaryQuery struct {
	CourseID  string `form:"course_id"  binding:"required,uuid"`
	SessionID string `form:"session_id" binding:"required,uuid"`
	StudentID string `form:"student_id" binding:"required,uuid"`
}

// ─── Helper ───────────────────────────────────────────────────────────────────

// encodeAttendanceData converts a slice of AttendanceRecord to a JSON raw
// message suitable for the JSONB attendance_data column.
func encodeAttendanceData(records []AttendanceRecord) (json.RawMessage, error) {
	if records == nil {
		records = []AttendanceRecord{}
	}
	raw, err := json.Marshal(records)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(raw), nil
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// createAttendanceSheet POST /attendance
func (server *Server) createAttendanceSheet(ctx *gin.Context) {
	var req createAttendanceSheetRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	classRepID, err := uuid.Parse(req.ClassRepID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid class_rep_id"})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	parsedDate, err := time.Parse(time.RFC3339, req.Date)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid date, expected RFC3339 (e.g. 2025-09-01T09:00:00Z)"})
		return
	}

	rawData, err := encodeAttendanceData(req.AttendanceData)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encode attendance data"})
		return
	}

	sheet, err := server.store.CreateAttendanceSheet(ctx, db.CreateAttendanceSheetParams{
		CourseID:       courseID,
		Date:           pgtype.Timestamptz{Time: parsedDate, Valid: true},
		ClassRepID:     classRepID,
		AttendanceData: rawData,
		SessionID:      sessionID,
		Status:         "draft",
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, sheet)
}

// getAttendanceSheet GET /attendance/:id
func (server *Server) getAttendanceSheet(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid attendance sheet id"})
		return
	}

	sheet, err := server.store.GetAttendanceSheet(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "attendance sheet not found"})
		return
	}

	ctx.JSON(http.StatusOK, sheet)
}

// listCourseAttendanceSheets GET /attendance/course
func (server *Server) listCourseAttendanceSheets(ctx *gin.Context) {
	var q listCourseAttendanceQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(q.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	sessionID, err := uuid.Parse(q.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	sheets, err := server.store.ListCourseAttendanceSheets(ctx, db.ListCourseAttendanceSheetsParams{
		CourseID:  courseID,
		SessionID: sessionID,
		Limit:     q.Limit,
		Offset:    q.Offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, sheets)
}

// listStudentAttendance GET /attendance/student
func (server *Server) listStudentAttendance(ctx *gin.Context) {
	var q listStudentAttendanceQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sessionID, err := uuid.Parse(q.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	sheets, err := server.store.ListStudentAttendance(ctx, db.ListStudentAttendanceParams{
		SessionID: sessionID,
		Column2:   q.StudentID, // passed as text into the JSONB @> query
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, sheets)
}

// updateAttendanceSheet PUT /attendance/:id
func (server *Server) updateAttendanceSheet(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid attendance sheet id"})
		return
	}

	var req updateAttendanceSheetRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rawData, err := encodeAttendanceData(req.AttendanceData)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encode attendance data"})
		return
	}

	status := req.Status
	if status == "" {
		status = "draft"
	}

	sheet, err := server.store.UpdateAttendanceSheet(ctx, db.UpdateAttendanceSheetParams{
		ID:                id,
		AttendanceData:    rawData,
		Status:            status,
		PdfUrl:            req.PdfUrl,
		EmailedToLecturer: req.EmailedToLecturer,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, sheet)
}

// finalizeAttendanceSheet POST /attendance/:id/finalize
func (server *Server) finalizeAttendanceSheet(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid attendance sheet id"})
		return
	}

	sheet, err := server.store.FinalizeAttendanceSheet(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, sheet)
}

// getAttendanceSummary GET /attendance/summary
func (server *Server) getAttendanceSummary(ctx *gin.Context) {
	var q attendanceSummaryQuery
	if err := ctx.ShouldBindQuery(&q); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(q.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	sessionID, err := uuid.Parse(q.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	summary, err := server.store.GetAttendanceSummary(ctx, db.GetAttendanceSummaryParams{
		CourseID:  courseID,
		SessionID: sessionID,
		Column3:   q.StudentID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	attendanceRate := 0.0
	if summary.TotalClasses > 0 {
		attendanceRate = float64(summary.AttendedClasses) / float64(summary.TotalClasses) * 100
	}

	ctx.JSON(http.StatusOK, gin.H{
		"course_id":        q.CourseID,
		"session_id":       q.SessionID,
		"student_id":       q.StudentID,
		"total_classes":    summary.TotalClasses,
		"attended_classes": summary.AttendedClasses,
		"absent_classes":   summary.TotalClasses - summary.AttendedClasses,
		"attendance_rate":  attendanceRate,
	})
}

// deleteAttendanceSheet DELETE /attendance/:id
func (server *Server) deleteAttendanceSheet(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid attendance sheet id"})
		return
	}

	if err := server.store.DeleteAttendanceSheet(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "attendance sheet deleted successfully"})
}
