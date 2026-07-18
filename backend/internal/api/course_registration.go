package api

import (
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createCourseRegistrationRequest struct {
	StudentID  string `json:"student_id" binding:"required,uuid"`
	SessionID  string `json:"session_id" binding:"required,uuid"`
	SemesterID string `json:"semester_id" binding:"required,uuid"`
	TotalUnits int32  `json:"total_units"`
	Status     string `json:"status" binding:"omitempty"`
}

func (server *Server) createCourseRegistration(ctx *gin.Context) {
	var req createCourseRegistrationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID, err := uuid.Parse(req.StudentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student_id"})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	semesterID, err := uuid.Parse(req.SemesterID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester_id"})
		return
	}

	status := req.Status
	if status == "" {
		status = "draft"
	}

	arg := db.CreateCourseRegistrationParams{
		StudentID:  studentID,
		SessionID:  sessionID,
		SemesterID: semesterID,
		TotalUnits: req.TotalUnits,
		Status:     status,
	}

	registration, err := server.store.CreateCourseRegistration(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, registration)
}

func (server *Server) getCourseRegistration(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course registration id"})
		return
	}

	registration, err := server.store.GetCourseRegistration(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "course registration not found"})
		return
	}

	ctx.JSON(http.StatusOK, registration)
}

func (server *Server) listStudentCourseRegistrations(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	registrations, err := server.store.ListStudentCourseRegistrations(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, registrations)
}

type updateCourseRegistrationRequest struct {
	TotalUnits int32  `json:"total_units"`
	Status     string `json:"status" binding:"required"`
	ApprovedBy string `json:"approved_by" binding:"omitempty,uuid"`
	ApprovedAt string `json:"approved_at" binding:"omitempty"` // RFC3339
}

func (server *Server) updateCourseRegistration(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course registration id"})
		return
	}

	var req updateCourseRegistrationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateCourseRegistrationParams{
		ID:         id,
		TotalUnits: req.TotalUnits,
		Status:     req.Status,
	}

	if req.ApprovedBy != "" {
		approvedByID, err := uuid.Parse(req.ApprovedBy)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid approved_by id"})
			return
		}
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

	registration, err := server.store.UpdateCourseRegistration(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, registration)
}

type createRegisteredCourseRequest struct {
	CourseID          string `json:"course_id" binding:"required,uuid"`
	Status            string `json:"status" binding:"omitempty"`
	IsCarryover       bool   `json:"is_carryover"`
	PreviousAttemptID string `json:"previous_attempt_id" binding:"omitempty,uuid"`
}

func (server *Server) createRegisteredCourse(ctx *gin.Context) {
	registrationID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course registration id"})
		return
	}

	var req createRegisteredCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	status := req.Status
	if status == "" {
		status = "enrolled"
	}

	arg := db.CreateRegisteredCourseParams{
		RegistrationID: registrationID,
		CourseID:       courseID,
		Status:         status,
		IsCarryover:    req.IsCarryover,
	}

	if req.PreviousAttemptID != "" {
		prevAttemptID, err := uuid.Parse(req.PreviousAttemptID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid previous_attempt_id"})
			return
		}
		arg.PreviousAttemptID = pgtype.UUID{Bytes: prevAttemptID, Valid: true}
	}

	registeredCourse, err := server.store.CreateRegisteredCourse(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, registeredCourse)
}

func (server *Server) listRegisteredCourses(ctx *gin.Context) {
	registrationID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course registration id"})
		return
	}

	registeredCourses, err := server.store.ListRegisteredCoursesByRegistration(ctx, registrationID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, registeredCourses)
}

func (server *Server) deleteRegisteredCourse(ctx *gin.Context) {
	// The id in the param here should be the ID of the registered course
	registeredCourseID, err := uuid.Parse(ctx.Param("registered_course_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid registered course id"})
		return
	}

	if err := server.store.DeleteRegisteredCourse(ctx, registeredCourseID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "registered course deleted successfully"})
}

type updateRegisteredCourseRequest struct {
	Status            string `json:"status" binding:"required"`
	IsCarryover       bool   `json:"is_carryover"`
	PreviousAttemptID string `json:"previous_attempt_id" binding:"omitempty,uuid"`
}

func (server *Server) updateRegisteredCourse(ctx *gin.Context) {
	idStr := ctx.Param("registered_course_id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid registered course id"})
		return
	}

	var req updateRegisteredCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateRegisteredCourseParams{
		ID:          id,
		Status:      req.Status,
		IsCarryover: req.IsCarryover,
	}

	if req.PreviousAttemptID != "" {
		prevID, err := uuid.Parse(req.PreviousAttemptID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid previous_attempt_id"})
			return
		}
		arg.PreviousAttemptID = pgtype.UUID{Bytes: prevID, Valid: true}
	}

	registeredCourse, err := server.store.UpdateRegisteredCourse(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, registeredCourse)
}

type submitRegistrationRequest struct {
	SessionID  string   `json:"session_id" binding:"required,uuid"`
	SemesterID string   `json:"semester_id" binding:"required,uuid"`
	CourseIDs  []string `json:"course_ids" binding:"required,min=1"`
}

func (server *Server) submitRegistration(ctx *gin.Context) {
	var req submitRegistrationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := getUserID(ctx)

	// Resolve student ID from user ID
	student, err := server.store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "student profile not found"})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	semesterID, err := uuid.Parse(req.SemesterID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester_id"})
		return
	}

	// Check for existing confirmed registration for this session+semester
	existingRegs, err := server.store.ListStudentCourseRegistrations(ctx, student.ID)
	if err == nil {
		for _, reg := range existingRegs {
			if reg.SessionID == sessionID && reg.SemesterID == semesterID && (reg.Status == "submitted" || reg.Status == "approved") {
				ctx.JSON(http.StatusConflict, gin.H{"error": "you already have a confirmed registration for this semester"})
				return
			}
		}
	}

	// Calculate total units
	var totalUnits int32
	courseUUIDs := make([]uuid.UUID, 0, len(req.CourseIDs))
	for _, cid := range req.CourseIDs {
		courseID, err := uuid.Parse(cid)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id: " + cid})
			return
		}
		course, err := server.store.GetCourse(ctx, courseID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "course not found: " + cid})
			return
		}
		totalUnits += course.Unit
		courseUUIDs = append(courseUUIDs, courseID)
	}

	// Validate credit load
	if totalUnits < 12 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "minimum credit load is 12 units"})
		return
	}
	if totalUnits > 24 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "maximum credit load is 24 units"})
		return
	}

	// Create the registration header
	registration, err := server.store.CreateCourseRegistration(ctx, db.CreateCourseRegistrationParams{
		StudentID:  student.ID,
		SessionID:  sessionID,
		SemesterID: semesterID,
		TotalUnits: totalUnits,
		Status:     "submitted",
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create registration: " + err.Error()})
		return
	}

	// Register each course
	registeredCourses := make([]db.RegisteredCourse, 0, len(courseUUIDs))
	for _, courseID := range courseUUIDs {
		rc, err := server.store.CreateRegisteredCourse(ctx, db.CreateRegisteredCourseParams{
			RegistrationID: registration.ID,
			CourseID:       courseID,
			Status:         "enrolled",
			IsCarryover:    false,
		})
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register course: " + err.Error()})
			return
		}
		registeredCourses = append(registeredCourses, rc)
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"registration":     registration,
		"registered_courses": registeredCourses,
	})
}
