package api

import (
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (server *Server) listAllCourseSubcategories(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	courses, err := queries.ListCourses(ctx, db.ListCoursesParams{Limit: 500, Offset: 0})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type subcatWithCourse struct {
		ID               string `json:"id"`
		CourseID         string `json:"course_id"`
		Name             string `json:"name"`
		WeightPercentage int32  `json:"weight_percentage"`
		IsActive         bool   `json:"isActive"`
		CourseName       string `json:"courseName"`
	}

	all := []subcatWithCourse{}
	for _, c := range courses {
		subs, err := queries.ListCourseSubcategories(ctx, c.ID)
		if err != nil {
			continue
		}
		for _, s := range subs {
			all = append(all, subcatWithCourse{
				ID:               s.ID.String(),
				CourseID:         s.CourseID.String(),
				Name:             s.Name,
				WeightPercentage: s.WeightPercentage,
				IsActive:         s.IsActive,
				CourseName:       c.Code + " - " + c.Title,
			})
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": all})
}

type createCourseSubcategoryRequest struct {
	CourseID         string `json:"course_id" binding:"required,uuid"`
	Name             string `json:"name" binding:"required"`
	WeightPercentage int32  `json:"weight_percentage" binding:"required,min=0,max=100"`
}

func (server *Server) createCourseSubcategory(ctx *gin.Context) {
	var req createCourseSubcategoryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	courseID, _ := uuid.Parse(req.CourseID)
	sub, err := queries.CreateCourseSubcategory(ctx, db.CreateCourseSubcategoryParams{
		CourseID:         courseID,
		Name:             req.Name,
		WeightPercentage: req.WeightPercentage,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": sub})
}

type updateCourseSubcategoryRequest struct {
	Name             string `json:"name"`
	WeightPercentage int32  `json:"weight_percentage"`
	IsActive         *bool  `json:"isActive"`
}

func (server *Server) updateCourseSubcategoryHandler(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid subcategory id"})
		return
	}

	var req updateCourseSubcategoryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	existing, err := queries.GetCourseSubcategory(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "subcategory not found"})
		return
	}

	name := existing.Name
	if req.Name != "" {
		name = req.Name
	}
	weight := existing.WeightPercentage
	if req.WeightPercentage > 0 {
		weight = req.WeightPercentage
	}
	active := existing.IsActive
	if req.IsActive != nil {
		active = *req.IsActive
	}

	sub, err := queries.UpdateCourseSubcategory(ctx, db.UpdateCourseSubcategoryParams{
		ID:               id,
		Name:             name,
		WeightPercentage: weight,
		IsActive:         active,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": sub})
}

func (server *Server) deleteCourseSubcategoryHandler(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid subcategory id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.DeleteCourseSubcategory(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "subcategory deleted successfully"})
}
