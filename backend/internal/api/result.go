package api

import (
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

type createResultRequest struct {
	StudentID   string          `json:"student_id" binding:"required,uuid"`
	CourseID    string          `json:"course_id" binding:"required,uuid"`
	SessionID   string          `json:"session_id" binding:"required,uuid"`
	SemesterID  string          `json:"semester_id" binding:"required,uuid"`
	CaScore     decimal.Decimal `json:"ca_score"`
	ExamScore   decimal.Decimal `json:"exam_score"`
	TotalScore  decimal.Decimal `json:"total_score"`
	Grade       string          `json:"grade"`
	GradePoint  float64         `json:"grade_point"`
	Status      string          `json:"status"`
	IsCarryover bool            `json:"is_carryover"`
}

func (server *Server) createResult(ctx *gin.Context) {
	var req createResultRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, _ := uuid.Parse(req.StudentID)
	courseID, _ := uuid.Parse(req.CourseID)
	sessionID, _ := uuid.Parse(req.SessionID)
	semesterID, _ := uuid.Parse(req.SemesterID)

	status := req.Status
	if status == "" {
		status = "pending"
	}

	arg := db.CreateResultParams{
		StudentID:   studentID,
		CourseID:    courseID,
		SessionID:   sessionID,
		SemesterID:  semesterID,
		CaScore:     req.CaScore,
		ExamScore:   req.ExamScore,
		TotalScore:  req.TotalScore,
		Status:      db.ResultStatus(status),
		IsCarryover: req.IsCarryover,
	}

	if req.Grade != "" {
		arg.Grade = db.NullGrade{Grade: db.Grade(req.Grade), Valid: true}
	}
	
	// Convert float64 grade point to numeric type
	var err error
	arg.GradePoint.Int.SetInt64(int64(req.GradePoint * 100)) // Assuming 2 decimal places max
	arg.GradePoint.Exp = -2
	arg.GradePoint.Valid = true

	result, err := server.store.CreateResult(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, result)
}

func (server *Server) getResult(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid result id"})
		return
	}

	result, err := server.store.GetResult(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "result not found"})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) listStudentResults(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	results, err := server.store.ListStudentResults(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, results)
}

func (server *Server) listCourseResults(ctx *gin.Context) {
	courseID, err := uuid.Parse(ctx.Param("course_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	sessionID, err := uuid.Parse(ctx.Param("session_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	arg := db.ListCourseResultsParams{
		CourseID:  courseID,
		SessionID: sessionID,
	}

	results, err := server.store.ListCourseResults(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, results)
}

type updateResultRequest struct {
	CaScore    decimal.Decimal `json:"ca_score"`
	ExamScore  decimal.Decimal `json:"exam_score"`
	TotalScore decimal.Decimal `json:"total_score"`
	Grade      string          `json:"grade"`
	GradePoint float64         `json:"grade_point"`
	Status     string          `json:"status"`
}

func (server *Server) updateResult(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid result id"})
		return
	}

	var req updateResultRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateResultParams{
		ID:         id,
		CaScore:    req.CaScore,
		ExamScore:  req.ExamScore,
		TotalScore: req.TotalScore,
		Status:     db.ResultStatus(req.Status),
	}

	if req.Grade != "" {
		arg.Grade = db.NullGrade{Grade: db.Grade(req.Grade), Valid: true}
	}

	arg.GradePoint.Int.SetInt64(int64(req.GradePoint * 100))
	arg.GradePoint.Exp = -2
	arg.GradePoint.Valid = true

	result, err := server.store.UpdateResult(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

type updateResultStatusRequest struct {
	Status          string `json:"status" binding:"required"`
	ApprovedBy      string `json:"approved_by" binding:"omitempty,uuid"`
	ApprovedAt      string `json:"approved_at" binding:"omitempty"` // RFC3339
	RejectionReason string `json:"rejection_reason" binding:"omitempty"`
}

func (server *Server) updateResultStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid result id"})
		return
	}

	var req updateResultStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateResultStatusParams{
		ID:     id,
		Status: db.ResultStatus(req.Status),
	}

	if req.ApprovedBy != "" {
		approvedByID, _ := uuid.Parse(req.ApprovedBy)
		arg.ApprovedBy = pgtype.UUID{Bytes: approvedByID, Valid: true}
	}

	if req.ApprovedAt != "" {
		parsedDate, err := time.Parse(time.RFC3339, req.ApprovedAt)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid approved_at date, expected RFC3339"})
			return
		}
		arg.ApprovedAt = pgtype.Timestamptz{Time: parsedDate, Valid: true}
	}

	if req.RejectionReason != "" {
		arg.RejectionReason = &req.RejectionReason
	}

	result, err := server.store.UpdateResultStatus(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

type createResultAuditLogRequest struct {
	FieldChanged string  `json:"field_changed" binding:"required"`
	OldValue     *string `json:"old_value"`
	NewValue     *string `json:"new_value"`
	Reason       string  `json:"reason" binding:"required"`
	EditedBy     string  `json:"edited_by" binding:"required,uuid"`
	IpAddress    *string `json:"ip_address"`
	UserAgent    *string `json:"user_agent"`
}

func (server *Server) createResultAuditLog(ctx *gin.Context) {
	resultID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid result id"})
		return
	}

	var req createResultAuditLogRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	editedBy, _ := uuid.Parse(req.EditedBy)

	arg := db.CreateResultAuditLogParams{
		ResultID:     resultID,
		FieldChanged: req.FieldChanged,
		OldValue:     req.OldValue,
		NewValue:     req.NewValue,
		Reason:       req.Reason,
		EditedBy:     editedBy,
		IpAddress:    req.IpAddress,
		UserAgent:    req.UserAgent,
	}

	auditLog, err := server.store.CreateResultAuditLog(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, auditLog)
}

func (server *Server) listResultAuditLogs(ctx *gin.Context) {
	resultID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid result id"})
		return
	}

	auditLogs, err := server.store.ListResultAuditLogs(ctx, resultID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, auditLogs)
}

type createCarryoverCourseRequest struct {
	StudentID         string `json:"student_id" binding:"required,uuid"`
	CourseID          string `json:"course_id" binding:"required,uuid"`
	OriginalResultID  string `json:"original_result_id" binding:"required,uuid"`
	OriginalSessionID string `json:"original_session_id" binding:"required,uuid"`
	AttemptCount      int32  `json:"attempt_count"`
	MaxAttempts       int32  `json:"max_attempts"`
}

func (server *Server) createCarryoverCourse(ctx *gin.Context) {
	var req createCarryoverCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, _ := uuid.Parse(req.StudentID)
	courseID, _ := uuid.Parse(req.CourseID)
	originalResultID, _ := uuid.Parse(req.OriginalResultID)
	originalSessionID, _ := uuid.Parse(req.OriginalSessionID)

	maxAttempts := req.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = 3
	}

	attemptCount := req.AttemptCount
	if attemptCount <= 0 {
		attemptCount = 1
	}

	arg := db.CreateCarryoverCourseParams{
		StudentID:         studentID,
		CourseID:          courseID,
		OriginalResultID:  originalResultID,
		OriginalSessionID: originalSessionID,
		AttemptCount:      attemptCount,
		MaxAttempts:       maxAttempts,
	}

	carryover, err := server.store.CreateCarryoverCourse(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, carryover)
}

func (server *Server) getCarryoverCourse(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid carryover course id"})
		return
	}

	carryover, err := server.store.GetCarryoverCourse(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "carryover course not found"})
		return
	}

	ctx.JSON(http.StatusOK, carryover)
}

type updateCarryoverCourseRequest struct {
	AttemptCount     int32  `json:"attempt_count" binding:"required"`
	IsResolved       bool   `json:"is_resolved"`
	ResolvedResultID string `json:"resolved_result_id" binding:"omitempty,uuid"`
}

func (server *Server) updateCarryoverCourse(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid carryover course id"})
		return
	}

	var req updateCarryoverCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateCarryoverCourseParams{
		ID:           id,
		AttemptCount: req.AttemptCount,
		IsResolved:   req.IsResolved,
	}

	if req.ResolvedResultID != "" {
		resolvedID, _ := uuid.Parse(req.ResolvedResultID)
		arg.ResolvedResultID = pgtype.UUID{Bytes: resolvedID, Valid: true}
	}

	carryover, err := server.store.UpdateCarryoverCourse(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, carryover)
}

func (server *Server) listStudentCarryoverCourses(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	carryovers, err := server.store.ListStudentCarryoverCourses(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, carryovers)
}
