package api

import (
	"fmt"
	"net/http"

	"github.com/aces/backend/internal/auth"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type createResultRequest struct {
	StudentID    string          `json:"student_id" binding:"omitempty,uuid"`
	CourseID     string          `json:"course_id" binding:"required,uuid"`
	SessionID    string          `json:"session_id" binding:"required,uuid"`
	SemesterID   string          `json:"semester_id" binding:"required,uuid"`
	CaScore      decimal.Decimal `json:"ca_score"`
	ExamScore    decimal.Decimal `json:"exam_score"`
	TotalScore   decimal.Decimal `json:"total_score"`
	Grade        string          `json:"grade"`
	GradePoint   float64         `json:"grade_point"`
	Status       string          `json:"status"`
	IsCarryover  bool            `json:"is_carryover"`
	MatricNumber *string         `json:"matric_number"`
}

func (server *Server) createResult(ctx *gin.Context) {
	var req createResultRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	// Validate score bounds
	if req.CaScore.LessThan(decimal.Zero) || req.CaScore.GreaterThan(decimal.NewFromInt(30)) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ca_score must be between 0 and 30"})
		return
	}
	if req.ExamScore.LessThan(decimal.Zero) || req.ExamScore.GreaterThan(decimal.NewFromInt(70)) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "exam_score must be between 0 and 70"})
		return
	}

	// Recompute total, grade, and grade_point server-side
	computedTotal := req.CaScore.Add(req.ExamScore)
	computedGrade, computedGradePoint := gradeFromScore(computedTotal)

	// Lecturer-course assignment check
	if claimsVal, exists := ctx.Get("claims"); exists {
		if c, ok := claimsVal.(*auth.Claims); ok && c.HasRole("lecturer") && !c.HasAnyRole([]string{"hod", "admin", "delegated_admin"}) {
			courseID, err := uuid.Parse(req.CourseID)
			if err != nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
				return
			}
			assigned, err := server.store.IsLecturerAssignedToCourse(ctx, db.IsLecturerAssignedToCourseParams{
				LecturerID: getUserID(ctx),
				CourseID:   courseID,
			})
			if err != nil || !assigned {
				ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to teach this course"})
				return
			}
			// A lecturer submits results, they don't sign off on them — that's
			// the HOD-only PUT /:id/status route. Without this, a lecturer could
			// set status: "approved" straight from the create/update endpoint.
			req.Status = string(db.ResultStatusPending)
		}
	}

	// Prevent duplicate result submission for the same student + course + session
	queries, okStore := server.store.(*db.Queries)
	if okStore {
		courseUUID, _ := uuid.Parse(req.CourseID)
		sessionUUID, _ := uuid.Parse(req.SessionID)
		var existingCount int
		if req.StudentID != "" {
			studentUUID, errS := uuid.Parse(req.StudentID)
			if errS == nil {
				_ = queries.GetDB().QueryRow(ctx, `
					SELECT COUNT(*)::int FROM results
					WHERE course_id = $1 AND session_id = $2 AND student_id = $3
				`, courseUUID, sessionUUID, studentUUID).Scan(&existingCount)
			}
		}
		if existingCount == 0 && req.MatricNumber != nil && *req.MatricNumber != "" {
			_ = queries.GetDB().QueryRow(ctx, `
				SELECT COUNT(*)::int FROM results
				WHERE course_id = $1 AND session_id = $2 AND LOWER(matric_number) = LOWER($3)
			`, courseUUID, sessionUUID, *req.MatricNumber).Scan(&existingCount)
		}
		if existingCount > 0 {
			ctx.JSON(http.StatusConflict, gin.H{"error": "Result for this student and course has already been submitted for this session"})
			return
		}
	}

	result, err := server.results.Create(ctx, service.CreateResultInput{
		StudentID:   req.StudentID,
		CourseID:    req.CourseID,
		SessionID:   req.SessionID,
		SemesterID:  req.SemesterID,
		CaScore:     req.CaScore,
		ExamScore:   req.ExamScore,
		TotalScore:  computedTotal,
		Grade:       computedGrade,
		GradePoint:  computedGradePoint,
		Status:      req.Status,
		IsCarryover: req.IsCarryover,
		MatricNumber: req.MatricNumber,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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

	if result.StudentID != nil {
		if !requireOwnershipOrStaff(ctx, server.store, *result.StudentID) {
			return
		}
	} else if !isStaffCaller(ctx) {
		// No student to compare ownership against — fail closed rather than
		// let any authenticated caller through.
		ctx.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
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

	// If caller is a student, they can only see their own results
	if !isStaffCaller(ctx) {
		callerStudentID, ok := requireOwnershipOrStaffByStudentIDParam(ctx, server.store)
		if !ok {
			return
		}
		studentID = callerStudentID
	}

	results, err := server.results.ListByStudent(ctx, studentID)
	if err != nil {
		// Fallback: the provided ID might be a user_id, not a student_id
		student, sErr := server.store.GetStudentByUserId(ctx, studentID)
		if sErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		results, err = server.results.ListByStudent(ctx, student.ID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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

	if !isStaffCaller(ctx) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	results, err := server.results.ListByCourse(ctx, courseID, sessionID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	// Fetch existing result for ownership check and score recomputation
	existing, err := server.store.GetResult(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "result not found"})
		return
	}

	// Preserve existing status if not provided in request
	if req.Status == "" {
		req.Status = string(existing.Status)
	}

	// Validate score bounds
	if req.CaScore.LessThan(decimal.Zero) || req.CaScore.GreaterThan(decimal.NewFromInt(30)) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ca_score must be between 0 and 30"})
		return
	}
	if req.ExamScore.LessThan(decimal.Zero) || req.ExamScore.GreaterThan(decimal.NewFromInt(70)) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "exam_score must be between 0 and 70"})
		return
	}

	// Recompute total, grade, and grade_point server-side
	computedTotal := req.CaScore.Add(req.ExamScore)
	computedGrade, computedGradePoint := gradeFromScore(computedTotal)

	// Lecturer-course assignment check
	if claimsVal, exists := ctx.Get("claims"); exists {
		if c, ok := claimsVal.(*auth.Claims); ok && c.HasRole("lecturer") && !c.HasAnyRole([]string{"hod", "admin", "delegated_admin"}) {
			assigned, err := server.store.IsLecturerAssignedToCourse(ctx, db.IsLecturerAssignedToCourseParams{
				LecturerID: getUserID(ctx),
				CourseID:   existing.CourseID,
			})
			if err != nil || !assigned {
				ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to teach this course"})
				return
			}
			// Same as createResult — a lecturer can edit their submission but
			// can't self-sign-off; approval only happens via the HOD-only
			// PUT /:id/status route.
			req.Status = string(db.ResultStatusPending)
		}
	}

	result, err := server.results.Update(ctx, id, service.UpdateResultInput{
		CaScore:    req.CaScore,
		ExamScore:  req.ExamScore,
		TotalScore: computedTotal,
		Grade:      computedGrade,
		GradePoint: computedGradePoint,
		Status:     req.Status,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

type updateResultStatusRequest struct {
	Status          string `json:"status" binding:"required"`
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	// Derived from the session, never the request body — an audit-trail
	// "approved by" field must record who actually authenticated the call.
	callerID := getUserID(ctx)
	approvedBy := &callerID

	var rejectionReason *string
	if req.RejectionReason != "" {
		rejectionReason = &req.RejectionReason
	}

	result, err := server.results.UpdateStatus(ctx, id, req.Status, approvedBy, rejectionReason)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Notify student about result status change
	if result.StudentID != nil {
		if student, err := server.store.GetStudent(ctx, *result.StudentID); err == nil {
			eType := "result"
			eID := result.ID
			title := "Result Status Updated"
			msg := fmt.Sprintf("Your result status has been updated to %s.", req.Status)
			if req.Status == "approved" {
				title = "Result Approved"
				msg = "Your result has been approved and is now official."
			} else if req.Status == "rejected" {
				title = "Result Rejected"
				msg = "Your result submission was rejected. Please check for details."
			}
			server.notifyUser(
				ctx,
				student.UserID,
				"result",
				"results",
				"high",
				title,
				msg,
				"/results",
				"View Results",
				&eType,
				&eID,
			)
		}
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) listAllResults(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}
	results, err := queries.ListAllResults(ctx, 5000, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": results, "total": len(results)})
}

func gradeFromScore(total decimal.Decimal) (string, float64) {
	return service.ScoreToGrade(total)
}

type createResultAuditLogRequest struct {
	FieldChanged string  `json:"field_changed" binding:"required"`
	OldValue     *string `json:"old_value"`
	NewValue     *string `json:"new_value"`
	Reason       string  `json:"reason" binding:"required"`
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	editedBy := getUserID(ctx)

	auditLog, err := server.results.CreateAuditLog(ctx, resultID, req.FieldChanged, req.OldValue, req.NewValue, req.Reason, editedBy, req.IpAddress, req.UserAgent)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, auditLogs)
}

func (server *Server) deleteResult(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid result id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.DeleteResult(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "result deleted successfully"})
}
