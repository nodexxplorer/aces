package api

import (
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createSubcategoryRequest struct {
	Module      string  `json:"module" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Color       *string `json:"color"`
	SortOrder   int32   `json:"sort_order"`
}

type updateSubcategoryRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Color       *string `json:"color"`
	SortOrder   *int32  `json:"sort_order"`
	IsActive    *bool   `json:"is_active"`
}

type reorderSubcategoriesRequest struct {
	Module string      `json:"module" binding:"required"`
	IDs    []uuid.UUID `json:"ids" binding:"required"`
}

func (server *Server) listSubcategories(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	module := ctx.Query("module")
	items, err := queries.ListSubcategories(ctx, module)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": items})
}

func (server *Server) createSubcategory(ctx *gin.Context) {
	var req createSubcategoryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	validModules := map[string]bool{"courses": true, "dues": true, "skills": true, "events": true, "announcements": true, "jobs": true, "groups": true}
	if !validModules[req.Module] {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid module"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	id, err := queries.CreateSubcategory(ctx, req.Module, req.Name, req.Description, req.Color, req.SortOrder)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}})
}

func (server *Server) updateSubcategory(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid subcategory id"})
		return
	}

	var req updateSubcategoryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	err = queries.UpdateSubcategory(ctx, id, req.Name, req.Description, req.Color, req.SortOrder, req.IsActive)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (server *Server) deleteSubcategory(ctx *gin.Context) {
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

	err = queries.DeleteSubcategory(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (server *Server) reorderSubcategories(ctx *gin.Context) {
	var req reorderSubcategoriesRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	err := queries.ReorderSubcategories(ctx, req.Module, req.IDs)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "reordered"})
}
