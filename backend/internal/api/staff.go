package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type createStaffRequest struct {
	UserID         string  `json:"user_id" binding:"required,uuid"`
	StaffID        string  `json:"staff_id" binding:"required"`
	Department     string  `json:"department" binding:"required"`
	Rank           *string `json:"rank" binding:"omitempty"`
	Specialization *string `json:"specialization" binding:"omitempty"`
	EmploymentDate *string `json:"employment_date" binding:"omitempty"`
}

func (server *Server) createStaff(ctx *gin.Context) {
	var req createStaffRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	arg := db.CreateStaffParams{
		UserID:         userID,
		StaffID:        strings.TrimSpace(req.StaffID),
		Department:     strings.TrimSpace(req.Department),
		Rank:           req.Rank,
		Specialization: req.Specialization,
	}

	if req.EmploymentDate != nil {
		t, err := time.Parse(time.RFC3339, *req.EmploymentDate)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid employment_date format, must be RFC3339"})
			return
		}
		arg.EmploymentDate = pgtype.Timestamptz{Time: t, Valid: true}
	} else {
		arg.EmploymentDate = pgtype.Timestamptz{Valid: false}
	}

	staff, err := server.store.CreateStaff(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, staff)
}

func (server *Server) getStaff(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid staff id"})
		return
	}

	staff, err := server.store.GetStaff(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, staff)
}

func (server *Server) getStaffByUserID(ctx *gin.Context) {
	userIDStr := ctx.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	staff, err := server.store.GetStaffByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, staff)
}

type listStaffRequest struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listStaff(ctx *gin.Context) {
	var req listStaffRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.ListStaffParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	staffList, err := server.store.ListStaff(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, staffList)
}

type updateStaffRequest struct {
	Department     string  `json:"department" binding:"required"`
	Rank           *string `json:"rank" binding:"omitempty"`
	Specialization *string `json:"specialization" binding:"omitempty"`
	EmploymentDate *string `json:"employment_date" binding:"omitempty"`
}

func (server *Server) updateStaff(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid staff id"})
		return
	}

	var req updateStaffRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateStaffParams{
		ID:             id,
		Department:     strings.TrimSpace(req.Department),
		Rank:           req.Rank,
		Specialization: req.Specialization,
	}

	if req.EmploymentDate != nil {
		t, err := time.Parse(time.RFC3339, *req.EmploymentDate)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid employment_date format, must be RFC3339"})
			return
		}
		arg.EmploymentDate = pgtype.Timestamptz{Time: t, Valid: true}
	}

	staff, err := server.store.UpdateStaff(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, staff)
}

func (server *Server) deleteStaff(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid staff id"})
		return
	}

	err = server.store.DeleteStaff(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "staff deleted"})
}
