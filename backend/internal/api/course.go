package api

import (
	"fmt"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
	CourseType     string  `json:"course_type" binding:"omitempty,oneof=departmental non_departmental"`
}

func (server *Server) createCourse(ctx *gin.Context) {
	var req createCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	course, err := server.courses.Create(ctx, service.CreateCourseInput{
		Code:           req.Code,
		Title:          req.Title,
		Description:    req.Description,
		Unit:           req.Unit,
		Level:          req.Level,
		Semester:       req.Semester,
		LecturerID:     req.LecturerID,
		PrerequisiteID: req.PrerequisiteID,
		MaxCreditHours: req.MaxCreditHours,
		IsActive:       req.IsActive,
		CourseType:     req.CourseType,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": course})
}

func (server *Server) getCourse(ctx *gin.Context) {
	idStr := ctx.Param("id")

	course, err := server.courses.GetByIDOrCode(ctx, idStr)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": course})
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

	courses, err := server.courses.List(ctx, req.PageSize, (req.PageID-1)*req.PageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": courses, "total": len(courses), "page": req.PageID, "perPage": req.PageSize, "totalPages": 1})
}

type updateCourseRequest struct {
	Title           *string `json:"title"`
	TitleCamel      *string `json:"titleCamel"`
	Description     *string `json:"description"`
	Unit            *int32  `json:"unit"`
	Level           *int32  `json:"level"`
	Semester        *string `json:"semester"`
	LecturerID      *string `json:"lecturer_id"`
	LecturerIDCamel *string `json:"lecturerId"`
	IsActive        *bool   `json:"is_active"`
	IsActiveCamel   *bool   `json:"isActive"`
	CourseType      *string `json:"course_type"`
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

	existing, err := server.courses.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}

	title := existing.Title
	if req.Title != nil {
		title = *req.Title
	} else if req.TitleCamel != nil {
		title = *req.TitleCamel
	}

	description := existing.Description
	if req.Description != nil {
		description = req.Description
	}

	unit := existing.Unit
	if req.Unit != nil {
		unit = *req.Unit
	}

	level := existing.Level
	if req.Level != nil {
		level = *req.Level
	}

	semester := string(existing.Semester)
	if req.Semester != nil {
		semester = *req.Semester
	}

	var lecturerID *string
	if req.LecturerID != nil {
		lecturerID = req.LecturerID
	} else if req.LecturerIDCamel != nil {
		lecturerID = req.LecturerIDCamel
	} else if existing.LecturerID.Valid {
		uid := uuid.UUID(existing.LecturerID.Bytes).String()
		lecturerID = &uid
	}

	if (req.LecturerID != nil && *req.LecturerID == "") || (req.LecturerIDCamel != nil && *req.LecturerIDCamel == "") {
		lecturerID = nil
	}

	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	} else if req.IsActiveCamel != nil {
		isActive = *req.IsActiveCamel
	}

	courseType := existing.CourseType
	if req.CourseType != nil {
		courseType = *req.CourseType
	}

	course, err := server.courses.Update(ctx, id, service.UpdateCourseInput{
		Title:       title,
		Description: description,
		Unit:        unit,
		Level:       level,
		Semester:    semester,
		LecturerID:  lecturerID,
		IsActive:    isActive,
		CourseType:  courseType,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": course})
}

func (server *Server) deleteCourse(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	err = server.courses.Delete(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "course deleted"})
}

func (server *Server) listCoursesByLevelAndSemester(ctx *gin.Context) {
	levelStr := ctx.Query("level")
	semester := ctx.Query("semester")

	if levelStr == "" || semester == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "level and semester query params required"})
		return
	}

	var level int32
	if _, err := fmt.Sscanf(levelStr, "%d", &level); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid level"})
		return
	}

	if semester != "harmattan" && semester != "rain" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "semester must be harmattan or rain"})
		return
	}

	courses, err := server.store.ListCoursesByLevelAndSemester(ctx, db.ListCoursesByLevelAndSemesterParams{
		Level:    level,
		Semester: db.SemesterSeason(semester),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": courses})
}

func (server *Server) countCourses(ctx *gin.Context) {
	count, err := server.store.CountCourses(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"count": count})
}
