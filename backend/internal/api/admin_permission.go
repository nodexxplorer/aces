package api

import (
	"errors"
	"net/http"

	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type grantAdminPermissionRequest struct {
	UserID                 string `json:"user_id" binding:"required,uuid"`
	CanManageResults       bool   `json:"can_manage_results"`
	CanManageUsers         bool   `json:"can_manage_users"`
	CanManageFinance       bool   `json:"can_manage_finance"`
	CanManageCourses       bool   `json:"can_manage_courses"`
	CanViewAnalytics       bool   `json:"can_view_analytics"`
	CanManageAnnouncements bool   `json:"can_manage_announcements"`
	CanBackupData          bool   `json:"can_backup_data"`
	GrantedByHodID         string `json:"granted_by_hod_id" binding:"required,uuid"`
}

func (server *Server) grantAdminPermission(ctx *gin.Context) {
	var req grantAdminPermissionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hodID, err := uuid.Parse(req.GrantedByHodID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.GrantAdminPermissionsParams{
		UserID:                 userID,
		CanManageResults:       req.CanManageResults,
		CanManageUsers:         req.CanManageUsers,
		CanManageFinance:       req.CanManageFinance,
		CanManageCourses:       req.CanManageCourses,
		CanViewAnalytics:       req.CanViewAnalytics,
		CanManageAnnouncements: req.CanManageAnnouncements,
		CanBackupData:          req.CanBackupData,
		GrantedByHodID:         hodID,
	}

	permission, err := server.store.GrantAdminPermissions(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, permission)
}

func (server *Server) getAdminPermission(ctx *gin.Context) {
	idStr := ctx.Param("user_id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	permission, err := server.store.GetAdminPermissions(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, permission)
}

type updateAdminPermissionRequest struct {
	CanManageResults       bool `json:"can_manage_results"`
	CanManageUsers         bool `json:"can_manage_users"`
	CanManageFinance       bool `json:"can_manage_finance"`
	CanManageCourses       bool `json:"can_manage_courses"`
	CanViewAnalytics       bool `json:"can_view_analytics"`
	CanManageAnnouncements bool `json:"can_manage_announcements"`
	CanBackupData          bool `json:"can_backup_data"`
}

func (server *Server) updateAdminPermission(ctx *gin.Context) {
	idStr := ctx.Param("user_id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var req updateAdminPermissionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.UpdateAdminPermissionsParams{
		UserID:                 userID,
		CanManageResults:       req.CanManageResults,
		CanManageUsers:         req.CanManageUsers,
		CanManageFinance:       req.CanManageFinance,
		CanManageCourses:       req.CanManageCourses,
		CanViewAnalytics:       req.CanViewAnalytics,
		CanManageAnnouncements: req.CanManageAnnouncements,
		CanBackupData:          req.CanBackupData,
	}

	permission, err := server.store.UpdateAdminPermissions(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, permission)
}

func (server *Server) revokeAdminPermission(ctx *gin.Context) {
	idStr := ctx.Param("user_id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = server.store.RevokeAdminPermissions(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "permission revoked"})
}

type listAdminPermissionsRequest struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listAdminPermissions(ctx *gin.Context) {
	var req listAdminPermissionsRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	arg := db.ListAdminPermissionsParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	permissions, err := server.store.ListAdminPermissions(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, errorResponse(err))
		return
	}

	ctx.JSON(http.StatusOK, permissions)
}
