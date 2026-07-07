package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type createCourseRequest struct {
	Code           string  `json:"code" binding:"required"`
	Title          string  `json:"title" binding:"required"`
	Description    *string `json:"description" binding:"omitempty"`
	Unit           int32   `json:"unit" binding:"required,min=1"`
	Level          int32   `json:"level" binding:"required,min=100"`
	Semester       string  `json:"semester" binding:"required,oneof=harmattan rain"`
	LecturerID     *string `json:"lecturer_id" binding:"omitempty,uuid"`
	PrerequisiteID *string `json:"prerequisite_id" binding:"omitempty,uuid"`
	MaxCreditHours *int32  `json:"max_credit_hours" binding:"omitempty,min=1"`
	IsActive       bool    `json:"is_active"`
}

func (server *Server) createCourse(ctx *gin.Context) {
	var req createCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.CreateCourseParams{
		Code:        strings.ToUpper(strings.TrimSpace(req.Code)),
		Title:       strings.TrimSpace(req.Title),
		Description: req.Description,
		Unit:        req.Unit,
		Level:       req.Level,
		Semester:    db.SemesterSeason(req.Semester),
		IsActive:    req.IsActive,
	}

	if req.LecturerID != nil {
		id, err := uuid.Parse(*req.LecturerID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturer_id"})
			return
		}
		arg.LecturerID = pgtype.UUID{Bytes: id, Valid: true}
	} else {
		arg.LecturerID = pgtype.UUID{Valid: false}
	}

	if req.PrerequisiteID != nil {
		id, err := uuid.Parse(*req.PrerequisiteID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid prerequisite_id"})
			return
		}
		arg.PrerequisiteID = pgtype.UUID{Bytes: id, Valid: true}
	} else {
		arg.PrerequisiteID = pgtype.UUID{Valid: false}
	}

	if req.MaxCreditHours != nil {
		arg.MaxCreditHours = pgtype.Int4{Int32: *req.MaxCreditHours, Valid: true}
	} else {
		arg.MaxCreditHours = pgtype.Int4{Valid: false}
	}

	course, err := server.store.CreateCourse(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, course)
}

func (server *Server) getCourse(ctx *gin.Context) {
	idStr := ctx.Param("id")

	id, err := uuid.Parse(idStr)
	if err != nil {
		// It might be a course code
		course, err := server.store.GetCourseByCode(ctx, strings.ToUpper(idStr))
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				ctx.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
				return
			}
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, course)
		return
	}

	course, err := server.store.GetCourse(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, course)
}

type listCoursesRequest struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listCourses(ctx *gin.Context) {
	var req listCoursesRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.ListCoursesParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	courses, err := server.store.ListCourses(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, courses)
}

type updateCourseRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description" binding:"omitempty"`
	Unit        int32   `json:"unit" binding:"required,min=1"`
	Level       int32   `json:"level" binding:"required,min=100"`
	Semester    string  `json:"semester" binding:"required,oneof=harmattan rain"`
	LecturerID  *string `json:"lecturer_id" binding:"omitempty,uuid"`
	IsActive    bool    `json:"is_active"`
}

func (server *Server) updateCourse(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	var req updateCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateCourseParams{
		ID:          id,
		Title:       strings.TrimSpace(req.Title),
		Description: req.Description,
		Unit:        req.Unit,
		Level:       req.Level,
		Semester:    db.SemesterSeason(req.Semester),
		IsActive:    req.IsActive,
	}

	if req.LecturerID != nil {
		lecturerID, err := uuid.Parse(*req.LecturerID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturer_id"})
			return
		}
		arg.LecturerID = pgtype.UUID{Bytes: lecturerID, Valid: true}
	} else {
		arg.LecturerID = pgtype.UUID{Valid: false}
	}

	course, err := server.store.UpdateCourse(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, course)
}

func (server *Server) deleteCourse(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	err = server.store.DeleteCourse(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "course deleted"})
}
