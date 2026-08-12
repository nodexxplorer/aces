package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createAppealRequest struct {
	CourseID   string   `json:"course_id" binding:"required"`
	SemesterID string   `json:"semester_id" binding:"required"`
	SessionID  string   `json:"session_id" binding:"required"`
	Reason     string   `json:"reason" binding:"required"`
	Evidence   []string `json:"evidence"`
}

func (server *Server) createGradeAppeal(ctx *gin.Context) {
	var req createAppealRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	semesterID, err := uuid.Parse(req.SemesterID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester_id"})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	var evidenceJSON []byte
	if req.Evidence != nil {
		evidenceJSON, err = json.Marshal(req.Evidence)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid evidence"})
			return
		}
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	appeal, err := queries.CreateGradeAppeal(ctx, db.CreateGradeAppealParams{
		StudentID:    userID,
		CourseID:     courseID,
		SemesterID:   semesterID,
		SessionID:    sessionID,
		Reason:       req.Reason,
		EvidenceUrls: evidenceJSON,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": appeal})
}

func (server *Server) listMyAppeals(ctx *gin.Context) {
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

	appeals, err := queries.ListStudentAppeals(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": appeals})
}

func (server *Server) listPendingAppeals(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	statusParam := ctx.Query("status")
	status := db.AppealStatusSubmitted
	if statusParam != "" {
		status = db.AppealStatus(statusParam)
	}

	appeals, err := queries.ListPendingAppeals(ctx, status)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": appeals})
}

func (server *Server) getGradeAppeal(ctx *gin.Context) {
	appealID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid appeal id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	appeal, err := queries.GetGradeAppeal(ctx, appealID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "appeal not found"})
		return
	}

	// appeal.StudentID is actually a users.id (createGradeAppeal stores
	// getUserID(ctx) directly, never students.id) — requireOwnershipOrStaff
	// compares against students.id and would always reject the real owner.
	if !isStaffCaller(ctx) && getUserID(ctx) != appeal.StudentID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you can only access your own records"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": appeal})
}

type updateAppealRequest struct {
	Status       string   `json:"status" binding:"required"`
	Response     string   `json:"response"`
	RevisedScore *float64 `json:"revised_score"`
}

func (server *Server) updateAppealStatus(ctx *gin.Context) {
	appealID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid appeal id"})
		return
	}

	var req updateAppealRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	if req.RevisedScore != nil && (*req.RevisedScore < 0 || *req.RevisedScore > 100) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "revised_score must be between 0 and 100"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	userID := getUserID(ctx)
	callerIsHOD := isStaffCaller(ctx)

	// Lecturer-course assignment check, matching result.go's pattern — a
	// lecturer may only resolve appeals for courses they actually teach.
	if !callerIsHOD {
		existingAppeal, gerr := queries.GetGradeAppeal(ctx, appealID)
		if gerr != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "appeal not found"})
			return
		}
		assigned, aerr := server.store.IsLecturerAssignedToCourse(ctx, db.IsLecturerAssignedToCourseParams{
			LecturerID: userID,
			CourseID:   existingAppeal.CourseID,
		})
		if aerr != nil || !assigned {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to teach this course"})
			return
		}
	}

	var lecturerResponse *string
	var lecturerID pgtype.UUID
	var hodResponse *string
	var hodID pgtype.UUID

	status := db.AppealStatus(req.Status)

	switch status {
	case db.AppealStatusLecturerReview, db.AppealStatusResolved, db.AppealStatusRejected:
		if callerIsHOD {
			hodID = pgtype.UUID{Bytes: userID, Valid: true}
			if req.Response != "" {
				hodResponse = &req.Response
			}
		} else {
			lecturerID = pgtype.UUID{Bytes: userID, Valid: true}
			if req.Response != "" {
				lecturerResponse = &req.Response
			}
		}
	case db.AppealStatusHodReview:
		hodID = pgtype.UUID{Bytes: userID, Valid: true}
		if req.Response != "" {
			hodResponse = &req.Response
		}
	default:
		if req.Response != "" {
			lecturerResponse = &req.Response
			hodResponse = &req.Response
		}
	}

	err = queries.UpdateGradeAppealStatus(ctx, db.UpdateGradeAppealStatusParams{
		ID:               appealID,
		Status:           status,
		LecturerResponse: lecturerResponse,
		LecturerID:       lecturerID,
		HodResponse:      hodResponse,
		HodID:            hodID,
		RevisedScore:     req.RevisedScore,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Notify the student about their grade appeal status change
	// The StudentID in grade_appeals is actually the user_id (set via getUserID)
	appeal, errGet := queries.GetGradeAppeal(ctx, appealID)
	if errGet == nil {
		title := "Grade Appeal Updated"
		msg := fmt.Sprintf("Your grade appeal status has been updated to %s.", req.Status)
		priority := "normal"
		switch status {
		case db.AppealStatusResolved:
			title = "Grade Appeal Resolved"
			msg = "Your grade appeal has been resolved. Please check the outcome."
			priority = "high"
		case db.AppealStatusRejected:
			title = "Grade Appeal Rejected"
			msg = "Your grade appeal has been rejected."
			priority = "high"
		case db.AppealStatusLecturerReview:
			title = "Grade Appeal Under Lecturer Review"
			msg = "Your grade appeal is now being reviewed by the lecturer."
		case db.AppealStatusHodReview:
			title = "Grade Appeal Under HOD Review"
			msg = "Your grade appeal has been escalated to the HOD for review."
		}
		eType := "grade_appeal"
		eID := appealID
		server.notifyUser(
			ctx,
			appeal.StudentID,
			"academic",
			"results",
			priority,
			title,
			msg,
			"/grade-appeals",
			"View Appeals",
			&eType,
			&eID,
		)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "appeal status updated"}})
}
