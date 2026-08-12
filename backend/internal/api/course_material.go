package api

import (
	"fmt"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func (server *Server) getMaterialsQueries() *db.Queries {
	q, _ := server.store.(*db.Queries)
	return q
}

// uploadCourseMaterial POST /course-materials — lecturer uploads a file
// (slide, past question, reading material) tied to one of their courses.
func (server *Server) uploadCourseMaterial(ctx *gin.Context) {
	lecturerID := getUserID(ctx)
	if lecturerID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	q := server.getMaterialsQueries()
	if q == nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	courseIDStr := ctx.PostForm("course_id")
	courseID, err := uuid.Parse(courseIDStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	title := ctx.PostForm("title")
	if title == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
		return
	}

	materialType := ctx.PostForm("material_type")
	switch materialType {
	case "slide", "past_question", "reading", "other":
	default:
		materialType = "other"
	}

	// Lecturers may only upload materials for courses they're actually
	// assigned to teach — admins/HODs can upload for any course.
	if !isStaffRole(ctx) {
		assigned, err := q.IsLecturerOrPrimaryForCourse(ctx, lecturerID, courseID)
		if err != nil || !assigned {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to this course"})
			return
		}
	}

	file, header, err := ctx.Request.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	savedPath, err := server.storage.SaveFile(header, "course-materials")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var description *string
	if d := ctx.PostForm("description"); d != "" {
		description = &d
	}

	var sessionID pgtype.UUID
	if sidStr := ctx.PostForm("session_id"); sidStr != "" {
		if sid, err := uuid.Parse(sidStr); err == nil {
			sessionID = pgtype.UUID{Bytes: sid, Valid: true}
		}
	}

	material, err := q.CreateCourseMaterial(ctx, db.CreateCourseMaterialParams{
		CourseID:     courseID,
		UploadedBy:   lecturerID,
		SessionID:    sessionID,
		Title:        title,
		Description:  description,
		MaterialType: materialType,
		FileUrl:      savedPath,
		FileName:     header.Filename,
		FileSize:     int32(header.Size),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": material})
}

// listCourseMaterialsByCourse GET /course-materials/course/:course_id
func (server *Server) listCourseMaterialsByCourse(ctx *gin.Context) {
	courseID, err := uuid.Parse(ctx.Param("course_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course id"})
		return
	}

	q := server.getMaterialsQueries()
	if q == nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	materials, err := q.ListCourseMaterialsByCourse(ctx, courseID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": materials})
}

// listMyCourseMaterials GET /course-materials/mine — a lecturer's own uploads.
func (server *Server) listMyCourseMaterials(ctx *gin.Context) {
	lecturerID := getUserID(ctx)
	if lecturerID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	q := server.getMaterialsQueries()
	if q == nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	materials, err := q.ListCourseMaterialsByLecturer(ctx, lecturerID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": materials})
}

// downloadCourseMaterial GET /course-materials/:id/download — tracks a
// download and redirects to the actual static file.
func (server *Server) downloadCourseMaterial(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid material id"})
		return
	}

	q := server.getMaterialsQueries()
	if q == nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	material, err := q.GetCourseMaterial(ctx, id)
	if err != nil || !material.IsActive {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "material not found"})
		return
	}

	_ = q.IncrementCourseMaterialDownloadCount(ctx, id)
	ctx.Redirect(http.StatusFound, fmt.Sprintf("/uploads/%s", material.FileUrl))
}

// deleteCourseMaterial DELETE /course-materials/:id
func (server *Server) deleteCourseMaterial(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid material id"})
		return
	}

	q := server.getMaterialsQueries()
	if q == nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	material, err := q.GetCourseMaterial(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "material not found"})
		return
	}

	if !isStaffRole(ctx) && material.UploadedBy != getUserID(ctx) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	if err := q.DeleteCourseMaterial(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "material removed"})
}
