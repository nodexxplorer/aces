package api

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	db "github.com/aces/backend/internal/db/sql"
)

// The grant request and update body use the same JSON names as the capabilities,
// one flag per admin area (see admin_grants.go).
type adminGrantFlags struct {
	CanManageResults       bool `json:"can_manage_results"`
	CanManageUsers         bool `json:"can_manage_users"`
	CanManageFinance       bool `json:"can_manage_finance"`
	CanManageCourses       bool `json:"can_manage_courses"`
	CanViewAnalytics       bool `json:"can_view_analytics"`
	CanManageAnnouncements bool `json:"can_manage_announcements"`
	CanBackupData          bool `json:"can_backup_data"`
	CanManageComplaints    bool `json:"can_manage_complaints"`
	CanManageAlumni        bool `json:"can_manage_alumni"`
	CanManageCourseForms   bool `json:"can_manage_course_forms"`
	CanManageSettings      bool `json:"can_manage_settings"`
}

type grantAdminPermissionRequest struct {
	UserID string `json:"user_id" binding:"required,uuid"`
	adminGrantFlags
}

// grantAdminPermission POST /admin-permissions — HOD only (see server.go). It sets
// the full set of flags for a delegated admin. The person must already hold the
// delegated admin role, because a grant to anyone else would do nothing.
func (server *Server) grantAdminPermission(ctx *gin.Context) {
	var req grantAdminPermissionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	holds, err := server.store.UserHoldsAdminRole(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if !holds {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "this person does not hold the delegated admin role"})
		return
	}

	// This route is hod-only (see server.go), so the caller's own ID is
	// always the true grantor — never trust the body for this.
	hodID := getUserID(ctx)

	arg := db.GrantAdminPermissionsParams{
		UserID:                 userID,
		CanManageResults:       req.CanManageResults,
		CanManageUsers:         req.CanManageUsers,
		CanManageFinance:       req.CanManageFinance,
		CanManageCourses:       req.CanManageCourses,
		CanViewAnalytics:       req.CanViewAnalytics,
		CanManageAnnouncements: req.CanManageAnnouncements,
		CanBackupData:          req.CanBackupData,
		CanManageComplaints:    req.CanManageComplaints,
		CanManageAlumni:        req.CanManageAlumni,
		CanManageCourseForms:   req.CanManageCourseForms,
		CanManageSettings:      req.CanManageSettings,
		GrantedByHodID:         hodID,
	}

	permission, err := server.store.GrantAdminPermissions(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, permission)
}

// getAdminPermission GET /admin-permissions/:user_id — the active grant, or 404.
func (server *Server) getAdminPermission(ctx *gin.Context) {
	idStr := ctx.Param("user_id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	permission, err := server.store.GetAdminPermissions(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "no active grant for this person"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, permission)
}

// updateAdminPermission PUT /admin-permissions/:user_id — changes the flags of an
// existing active grant. It returns 404 when there is no active grant to change.
func (server *Server) updateAdminPermission(ctx *gin.Context) {
	idStr := ctx.Param("user_id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	var req adminGrantFlags
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
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
		CanManageComplaints:    req.CanManageComplaints,
		CanManageAlumni:        req.CanManageAlumni,
		CanManageCourseForms:   req.CanManageCourseForms,
		CanManageSettings:      req.CanManageSettings,
	}

	permission, err := server.store.UpdateAdminPermissions(ctx, arg)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "no active grant for this person"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, permission)
}

// revokeAdminPermission DELETE /admin-permissions/:user_id — deactivates the grant
// and turns every flag off, so the person has no admin capability.
func (server *Server) revokeAdminPermission(ctx *gin.Context) {
	idStr := ctx.Param("user_id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	err = server.store.RevokeAdminPermissions(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "permission revoked"})
}

type listAdminPermissionsRequest struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

// listAdminPermissions GET /admin-permissions — active grants, one page at a time.
func (server *Server) listAdminPermissions(ctx *gin.Context) {
	var req listAdminPermissionsRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	arg := db.ListAdminPermissionsParams{
		Limit:  req.PageSize,
		Offset: (req.PageID - 1) * req.PageSize,
	}

	permissions, err := server.store.ListAdminPermissions(ctx, arg)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, permissions)
}
