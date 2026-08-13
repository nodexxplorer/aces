package api

import (
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

// decimalToNumeric converts a shopspring/decimal.Decimal to pgtype.Numeric.
func decimalToNumeric(d decimal.Decimal) pgtype.Numeric {
	coeff := d.Coefficient()
	exp := d.Exponent()
	return pgtype.Numeric{
		Int:   new(big.Int).Set(coeff),
		Exp:   exp,
		Valid: true,
	}
}

// requireAssignmentCourseAccess reports whether the caller may act on
// assignment id — staff always may; a lecturer only if they're assigned to
// teach the assignment's course. Writes the response and returns false if
// not; also returns false (with the response already written) if the
// assignment doesn't exist.
func (server *Server) requireAssignmentCourseAccess(ctx *gin.Context, assignmentID uuid.UUID) bool {
	if isStaffCaller(ctx) {
		return true
	}
	assignment, err := server.store.GetAssignment(ctx, assignmentID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "assignment not found"})
		return false
	}
	assigned, aerr := server.store.IsLecturerAssignedToCourse(ctx, db.IsLecturerAssignedToCourseParams{
		LecturerID: getUserID(ctx),
		CourseID:   assignment.CourseID,
	})
	if aerr != nil || !assigned {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to teach this course"})
		return false
	}
	return true
}

type createAssignmentRequest struct {
	CourseID              string   `json:"course_id" binding:"required,uuid"`
	Title                 string   `json:"title" binding:"required"`
	Description           *string  `json:"description"`
	Deadline              string   `json:"deadline" binding:"required"`
	MaxScore              int32    `json:"max_score" binding:"required"`
	AllowedFormats        []byte   `json:"allowed_formats"`
	FileUrl               *string  `json:"file_url"`
	UploadedByClassRepID  *string  `json:"uploaded_by_class_rep_id" binding:"omitempty,uuid"`
	SessionID             string   `json:"session_id" binding:"required,uuid"`
	SemesterID            string   `json:"semester_id" binding:"required,uuid"`
	IsActive              bool     `json:"is_active"`
}

func (server *Server) createAssignment(ctx *gin.Context) {
	var req createAssignmentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	courseID, _ := uuid.Parse(req.CourseID)
	sessionID, _ := uuid.Parse(req.SessionID)
	semesterID, _ := uuid.Parse(req.SemesterID)

	// Always the caller's own ID, never client-supplied — an audit-trail
	// identity field must record who actually authenticated the request.
	createdBy := getUserID(ctx)

	if !isStaffCaller(ctx) {
		assigned, aerr := server.store.IsLecturerAssignedToCourse(ctx, db.IsLecturerAssignedToCourseParams{
			LecturerID: createdBy,
			CourseID:   courseID,
		})
		if aerr != nil || !assigned {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to teach this course"})
			return
		}
	}

	deadline, err := time.Parse(time.RFC3339, req.Deadline)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid deadline format"})
		return
	}

	arg := db.CreateAssignmentParams{
		CourseID:       courseID,
		Title:          strings.TrimSpace(req.Title),
		Description:    req.Description,
		Deadline:       pgtype.Timestamptz{Time: deadline, Valid: true},
		MaxScore:       req.MaxScore,
		AllowedFormats: req.AllowedFormats,
		FileUrl:        req.FileUrl,
		CreatedBy:      createdBy,
		SessionID:      sessionID,
		SemesterID:     semesterID,
		IsActive:       req.IsActive,
	}

	if req.UploadedByClassRepID != nil {
		repID, _ := uuid.Parse(*req.UploadedByClassRepID)
		arg.UploadedByClassRepID = pgtype.UUID{Bytes: repID, Valid: true}
	} else {
		arg.UploadedByClassRepID = pgtype.UUID{Valid: false}
	}

	assignment, err := server.store.CreateAssignment(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, assignment)
}

func (server *Server) getAssignment(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}

	assignment, err := server.store.GetAssignment(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "assignment not found"})
		return
	}

	ctx.JSON(http.StatusOK, assignment)
}

func (server *Server) listCourseAssignments(ctx *gin.Context) {
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

	arg := db.ListCourseAssignmentsParams{
		CourseID:  courseID,
		SessionID: sessionID,
	}

	assignments, err := server.store.ListCourseAssignments(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, assignments)
}

type updateAssignmentRequest struct {
	Title          string  `json:"title" binding:"required"`
	Description    *string `json:"description"`
	Deadline       string  `json:"deadline" binding:"required"`
	MaxScore       int32   `json:"max_score" binding:"required"`
	AllowedFormats []byte  `json:"allowed_formats"`
	FileUrl        *string `json:"file_url"`
	IsActive       bool    `json:"is_active"`
}

func (server *Server) updateAssignment(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}

	if !server.requireAssignmentCourseAccess(ctx, id) {
		return
	}

	var req updateAssignmentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	deadline, err := time.Parse(time.RFC3339, req.Deadline)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid deadline format"})
		return
	}

	arg := db.UpdateAssignmentParams{
		ID:             id,
		Title:          strings.TrimSpace(req.Title),
		Description:    req.Description,
		Deadline:       pgtype.Timestamptz{Time: deadline, Valid: true},
		MaxScore:       req.MaxScore,
		AllowedFormats: req.AllowedFormats,
		FileUrl:        req.FileUrl,
		IsActive:       req.IsActive,
	}

	assignment, err := server.store.UpdateAssignment(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, assignment)
}

func (server *Server) deleteAssignment(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}

	if !server.requireAssignmentCourseAccess(ctx, id) {
		return
	}

	if err := server.store.DeleteAssignment(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "assignment deleted"})
}

type createAssignmentGradeRequest struct {
	AssignmentID string          `json:"assignment_id" binding:"required,uuid"`
	StudentID    string          `json:"student_id" binding:"required,uuid"`
	Score        decimal.Decimal `json:"score"`
	Feedback     *string         `json:"feedback"`
	IsLate       bool            `json:"is_late"`
}

func (server *Server) createAssignmentGrade(ctx *gin.Context) {
	var req createAssignmentGradeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	assignmentID, _ := uuid.Parse(req.AssignmentID)
	studentID, _ := uuid.Parse(req.StudentID)

	// Derive graded_by from the JWT caller — never trust the client
	gradedBy := getUserID(ctx)

	// Fetch assignment to validate score bounds
	assignment, err := server.store.GetAssignment(ctx, assignmentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "assignment not found"})
		return
	}

	if !isStaffCaller(ctx) {
		assigned, aerr := server.store.IsLecturerAssignedToCourse(ctx, db.IsLecturerAssignedToCourseParams{
			LecturerID: gradedBy,
			CourseID:   assignment.CourseID,
		})
		if aerr != nil || !assigned {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to teach this course"})
			return
		}
	}

	if req.Score.LessThan(decimal.Zero) || req.Score.GreaterThan(decimal.NewFromInt(int64(assignment.MaxScore))) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "score must be between 0 and max_score"})
		return
	}

	arg := db.CreateAssignmentGradeParams{
		AssignmentID: assignmentID,
		StudentID:    studentID,
		Score:        decimalToNumeric(req.Score),
		Feedback:     req.Feedback,
		IsLate:       req.IsLate,
		GradedBy:     gradedBy,
	}

	grade, err := server.store.CreateAssignmentGrade(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, grade)
}

func (server *Server) getAssignmentGrade(ctx *gin.Context) {
	assignmentID, err := uuid.Parse(ctx.Query("assignment_id"))
	studentID, err2 := uuid.Parse(ctx.Query("student_id"))
	
	if err != nil || err2 != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment_id or student_id query param"})
		return
	}

	// If caller is a student, they can only view their own grade
	if !isStaffCaller(ctx) {
		callerStudentID, ok := requireOwnershipOrStaffByStudentIDParam(ctx, server.store)
		if !ok {
			return
		}
		studentID = callerStudentID
	}

	arg := db.GetAssignmentGradeParams{
		AssignmentID: assignmentID,
		StudentID:    studentID,
	}

	grade, err := server.store.GetAssignmentGrade(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "grade not found"})
		return
	}

	ctx.JSON(http.StatusOK, grade)
}

func (server *Server) listAssignmentGrades(ctx *gin.Context) {
	assignmentID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignment id"})
		return
	}

	grades, err := server.store.ListAssignmentGrades(ctx, assignmentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, grades)
}

func (server *Server) listStudentAssignmentGrades(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	if !isStaffCaller(ctx) {
		callerStudentID, ok := requireOwnershipOrStaffByStudentIDParam(ctx, server.store)
		if !ok {
			return
		}
		studentID = callerStudentID
	}

	grades, err := server.store.ListStudentAssignmentGrades(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, grades)
}

// requireAssignmentGradeCourseAccess reports whether the caller may act on
// assignment grade id — staff always may; a lecturer only if they're
// assigned to teach the parent assignment's course. Writes the response and
// returns false if not, or if the grade doesn't exist.
func (server *Server) requireAssignmentGradeCourseAccess(ctx *gin.Context, gradeID uuid.UUID) bool {
	if isStaffCaller(ctx) {
		return true
	}
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return false
	}
	grade, err := queries.GetAssignmentGradeByID(ctx, gradeID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "grade not found"})
		return false
	}
	assignment, err := server.store.GetAssignment(ctx, grade.AssignmentID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "assignment not found"})
		return false
	}
	assigned, aerr := server.store.IsLecturerAssignedToCourse(ctx, db.IsLecturerAssignedToCourseParams{
		LecturerID: getUserID(ctx),
		CourseID:   assignment.CourseID,
	})
	if aerr != nil || !assigned {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to teach this course"})
		return false
	}
	return true
}

type updateAssignmentGradeRequest struct {
	Score    decimal.Decimal `json:"score"`
	Feedback *string         `json:"feedback"`
	IsLate   bool            `json:"is_late"`
}

func (server *Server) updateAssignmentGrade(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid grade id"})
		return
	}

	if !server.requireAssignmentGradeCourseAccess(ctx, id) {
		return
	}

	var req updateAssignmentGradeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	// Derive graded_by from the JWT caller — never trust the client
	gradedBy := getUserID(ctx)

	arg := db.UpdateAssignmentGradeParams{
		ID:       id,
		Score:    decimalToNumeric(req.Score),
		Feedback: req.Feedback,
		IsLate:   req.IsLate,
		GradedBy: gradedBy,
	}

	grade, err := server.store.UpdateAssignmentGrade(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, grade)
}

func (server *Server) deleteAssignmentGrade(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid grade id"})
		return
	}

	if !server.requireAssignmentGradeCourseAccess(ctx, id) {
		return
	}

	if err := server.store.DeleteAssignmentGrade(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "grade deleted"})
}
