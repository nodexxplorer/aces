package api

import (
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

	result, err := server.results.Create(ctx, service.CreateResultInput{
		StudentID:   req.StudentID,
		CourseID:    req.CourseID,
		SessionID:   req.SessionID,
		SemesterID:  req.SemesterID,
		CaScore:     req.CaScore,
		ExamScore:   req.ExamScore,
		TotalScore:  req.TotalScore,
		Grade:       req.Grade,
		GradePoint:  req.GradePoint,
		Status:      req.Status,
		IsCarryover: req.IsCarryover,
	})
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

	result, err := server.results.GetByID(ctx, id)
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

	results, err := server.results.ListByStudent(ctx, studentID)
	if err != nil {
		// Fallback: the provided ID might be a user_id, not a student_id
		student, sErr := server.store.GetStudentByUserId(ctx, studentID)
		if sErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		results, err = server.results.ListByStudent(ctx, student.ID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
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

	results, err := server.results.ListByCourse(ctx, courseID, sessionID)
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

	result, err := server.results.Update(ctx, id, service.UpdateResultInput{
		CaScore:    req.CaScore,
		ExamScore:  req.ExamScore,
		TotalScore: req.TotalScore,
		Grade:      req.Grade,
		GradePoint: req.GradePoint,
		Status:     req.Status,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

type updateResultStatusRequest struct {
	Status          string `json:"status" binding:"required"`
	ApprovedBy      string `json:"approved_by" binding:"omitempty,uuid"`
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

	var approvedBy *uuid.UUID
	if req.ApprovedBy != "" {
		id, _ := uuid.Parse(req.ApprovedBy)
		approvedBy = &id
	}

	var rejectionReason *string
	if req.RejectionReason != "" {
		rejectionReason = &req.RejectionReason
	}

	result, err := server.results.UpdateStatus(ctx, id, req.Status, approvedBy, rejectionReason)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) listAllResults(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	results, err := queries.ListAllResults(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": results, "total": len(results)})
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

	auditLog, err := server.results.CreateAuditLog(ctx, resultID, req.FieldChanged, req.OldValue, req.NewValue, req.Reason, editedBy, req.IpAddress, req.UserAgent)
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

	auditLogs, err := server.results.ListAuditLogs(ctx, resultID)
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

	carryover, err := server.results.CreateCarryover(ctx, service.CreateCarryoverInput{
		StudentID:         req.StudentID,
		CourseID:          req.CourseID,
		OriginalResultID:  req.OriginalResultID,
		OriginalSessionID: req.OriginalSessionID,
		AttemptCount:      req.AttemptCount,
		MaxAttempts:       req.MaxAttempts,
	})
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

	carryover, err := server.results.GetCarryover(ctx, id)
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

	var resolvedResultID *string
	if req.ResolvedResultID != "" {
		resolvedResultID = &req.ResolvedResultID
	}

	carryover, err := server.results.UpdateCarryover(ctx, id, req.AttemptCount, req.IsResolved, resolvedResultID)
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

	carryovers, err := server.results.ListCarryovers(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, carryovers)
}

func (server *Server) deleteCarryoverCourse(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid carryover course id"})
		return
	}

	if err := server.results.DeleteCarryover(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "carryover course deleted successfully"})
}
