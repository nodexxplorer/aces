package api

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/aces/backend/internal/auth"
	db "github.com/aces/backend/internal/db/sql"
)

// AdminCapability is one area of the admin tier that a delegated admin can be
// granted. Its value is the flag name in admin_permissions, which is also the
// JSON name the API uses. Every admin-tier route and every staff-only branch in
// a handler names one of these, so a delegated admin can only use an area when
// the HOD has granted it.
type AdminCapability string

const (
	capManageResults       AdminCapability = "can_manage_results"       // results, grades, assignments, CGPA rules
	capManageUsers         AdminCapability = "can_manage_users"         // users, staff, lecturers, class reps, roles, approvals, profile requests
	capManageFinance       AdminCapability = "can_manage_finance"       // dues, payments, batches, expenses, graduation fees, bursar tools
	capManageCourses       AdminCapability = "can_manage_courses"       // courses, course registrations, attendance, course materials
	capViewAnalytics       AdminCapability = "can_view_analytics"       // analytics, reports, AI predictions
	capManageAnnouncements AdminCapability = "can_manage_announcements" // announcements, notifications, class notices, help articles
	capBackupData          AdminCapability = "can_backup_data"          // backups and restores
	capManageComplaints    AdminCapability = "can_manage_complaints"    // complaints, feedback, campus reports, strikes
	capManageAlumni        AdminCapability = "can_manage_alumni"        // alumni status, mentorship, jobs, events, donations
	capManageCourseForms   AdminCapability = "can_manage_course_forms"  // course form (CRF) history, signatures
	capManageSettings      AdminCapability = "can_manage_settings"      // sessions, semesters, rollover, calendar, feature flags
)

// allAdminCapabilities lists every capability in display order.
var allAdminCapabilities = []AdminCapability{
	capManageResults,
	capManageUsers,
	capManageFinance,
	capManageCourses,
	capViewAnalytics,
	capManageAnnouncements,
	capBackupData,
	capManageComplaints,
	capManageAlumni,
	capManageCourseForms,
	capManageSettings,
}

// adminTierRoles are the role names of a delegated admin. Their admin privileges
// come only from a grant. Every other role named on a route or in a handler
// (lecturer, bursar, class rep, HOD and so on) keeps working as before.
var adminTierRoles = []string{"admin", "delegated_admin"}

// adminGrantContextKey holds the caller's active grant for the request. It is set
// only for a delegated admin who has one.
const adminGrantContextKey = "admin_grant"

func isAdminTierRole(role string) bool {
	for _, r := range adminTierRoles {
		if r == role {
			return true
		}
	}
	return false
}

// grantAllows reports whether the grant includes capability c.
func grantAllows(g db.AdminPermission, c AdminCapability) bool {
	switch c {
	case capManageResults:
		return g.CanManageResults
	case capManageUsers:
		return g.CanManageUsers
	case capManageFinance:
		return g.CanManageFinance
	case capManageCourses:
		return g.CanManageCourses
	case capViewAnalytics:
		return g.CanViewAnalytics
	case capManageAnnouncements:
		return g.CanManageAnnouncements
	case capBackupData:
		return g.CanBackupData
	case capManageComplaints:
		return g.CanManageComplaints
	case capManageAlumni:
		return g.CanManageAlumni
	case capManageCourseForms:
		return g.CanManageCourseForms
	case capManageSettings:
		return g.CanManageSettings
	}
	return false
}

// dropGrantIfNoAdminRole switches off a person's grant once they no longer hold the
// delegated admin role. The grant already stops working without the role. Clearing
// it also means a later re-assignment starts with no admin capability.
func (server *Server) dropGrantIfNoAdminRole(ctx *gin.Context, userID uuid.UUID) error {
	holds, err := server.store.UserHoldsAdminRole(ctx.Request.Context(), userID)
	if err != nil {
		return err
	}
	if holds {
		return nil
	}
	return server.store.RevokeAdminPermissions(ctx.Request.Context(), userID)
}

// claimsOf returns the caller's token claims, if the request has them.
func claimsOf(ctx *gin.Context) (*auth.Claims, bool) {
	v, ok := ctx.Get("claims")
	if !ok {
		return nil, false
	}
	claims, ok := v.(*auth.Claims)
	return claims, ok && claims != nil
}

// loadAdminGrant runs once per authenticated request. For a delegated admin who is
// not also a HOD, it loads the active grant and stores it in the request context.
// Every other caller passes through unchanged. A database error stops the request,
// so the caller is never treated as more privileged than the database says.
func (server *Server) loadAdminGrant(ctx *gin.Context) {
	claims, ok := claimsOf(ctx)
	if !ok || claims.HasRole("hod") || !claims.HasAnyRole(adminTierRoles) {
		ctx.Next()
		return
	}
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		ctx.Next()
		return
	}
	grant, err := server.store.GetAdminPermissions(ctx.Request.Context(), userID)
	if errors.Is(err, pgx.ErrNoRows) {
		// No active grant: the caller gets no admin capability.
		ctx.Next()
		return
	}
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	ctx.Set(adminGrantContextKey, grant)
	ctx.Next()
}

// adminGrantAllows reports whether the request carries a grant that includes c.
func adminGrantAllows(ctx *gin.Context, c AdminCapability) bool {
	v, ok := ctx.Get(adminGrantContextKey)
	if !ok {
		return false
	}
	grant, ok := v.(db.AdminPermission)
	return ok && grantAllows(grant, c)
}

// staffAccess reports whether the caller holds one of roles with the capability c.
// A role in roles that is not an admin-tier role (HOD, lecturer, bursar, class rep)
// grants access by itself, as before. A delegated admin needs an active grant that
// includes c. A caller with neither gets false.
func staffAccess(ctx *gin.Context, c AdminCapability, roles ...string) bool {
	claims, ok := claimsOf(ctx)
	if !ok {
		return false
	}
	for _, r := range roles {
		if !isAdminTierRole(r) && claims.HasRole(r) {
			return true
		}
	}
	if !claims.HasAnyRole(adminTierRoles) {
		return false
	}
	return adminGrantAllows(ctx, c)
}

// requireCapability gates a route like middleware.RequireRoles does. When the caller
// reaches the route only through an admin-tier role, they also need the grant c.
// Any other listed role (for example lecturer on a grades route) passes as before.
func requireCapability(c AdminCapability, roles ...string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		claims, ok := claimsOf(ctx)
		if !ok {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if !claims.HasAnyRole(roles) || !staffAccess(ctx, c, roles...) {
			ctx.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}
		ctx.Next()
	}
}
