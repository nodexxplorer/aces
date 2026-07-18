package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type assignRoleRequest struct {
	UserID uuid.UUID   `json:"user_id" binding:"required"`
	Role   db.UserRole `json:"role" binding:"required"`
	Reason *string     `json:"reason"`
}

type revokeRoleRequest struct {
	UserID uuid.UUID   `json:"user_id" binding:"required"`
	Role   db.UserRole `json:"role" binding:"required"`
	Reason *string     `json:"reason"`
}

type promoteUserRequest struct {
	UserID    uuid.UUID   `json:"user_id" binding:"required"`
	FromRole  *db.UserRole `json:"from_role"`
	ToRole    db.UserRole `json:"to_role" binding:"required"`
	Reason    *string     `json:"reason"`
}

func (server *Server) assignUserRole(ctx *gin.Context) {
	var req assignRoleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assignedBy := getUserID(ctx)
	performedByRole := ctx.GetString("role")
	ipAddress := ctx.ClientIP()

	assignment, err := server.roles.AssignRoleWithAudit(ctx, req.UserID, req.Role, assignedBy, performedByRole, ipAddress, req.Reason)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, assignment)
}

func (server *Server) revokeUserRole(ctx *gin.Context) {
	var req revokeRoleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	revokedBy := getUserID(ctx)
	performedByRole := ctx.GetString("role")
	ipAddress := ctx.ClientIP()

	assignment, err := server.roles.RevokeRoleWithAudit(ctx, req.UserID, req.Role, revokedBy, performedByRole, ipAddress, req.Reason)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, assignment)
}

func (server *Server) listUserRoles(ctx *gin.Context) {
	userID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	roles, err := server.roles.ListUserRoles(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type roleResponse struct {
		ID         string `json:"id"`
		Role       string `json:"role"`
		IsActive   bool   `json:"is_active"`
		AssignedAt string `json:"assigned_at"`
	}
	result := make([]roleResponse, len(roles))
	for i, r := range roles {
		result[i] = roleResponse{
			ID:         r.ID.String(),
			Role:       service.ParseRoleName(string(r.Role)),
			IsActive:   r.IsActive,
			AssignedAt: r.AssignedAt.Time.Format("2006-01-02T15:04:05Z"),
		}
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) listUserRolesByName(ctx *gin.Context) {
	userID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	roleNames, err := server.roles.ListUserRolesByName(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Parse DB role names to frontend names
	parsed := make([]string, len(roleNames))
	for i, r := range roleNames {
		parsed[i] = service.ParseRoleName(r)
	}

	ctx.JSON(http.StatusOK, parsed)
}

func (server *Server) searchStudentsForRoleManagement(ctx *gin.Context) {
	search := ctx.DefaultQuery("search", "")
	pageStr := ctx.DefaultQuery("page", "1")
	perPageStr := ctx.DefaultQuery("per_page", "20")

	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(perPageStr)
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := int32((page - 1) * perPage)

	students, total, err := server.roles.SearchStudentsForRoleManagement(ctx, search, int32(perPage), offset)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type studentResponse struct {
		ID           string   `json:"id"`
		Email        string   `json:"email"`
		FullName     string   `json:"full_name"`
		AvatarUrl    *string  `json:"avatar_url"`
		StudentID    string   `json:"student_id"`
		MatricNumber *string  `json:"matric_number"`
		Level        *int32   `json:"level"`
		Roles        []string `json:"roles"`
	}

	result := make([]studentResponse, len(students))
	for i, s := range students {
		roleStr := ""
		if s.AllRoles != nil {
			if str, ok := s.AllRoles.(string); ok {
				roleStr = str
			}
		}
		roles := service.ParseAllRoles(roleStr)
		parsedRoles := make([]string, len(roles))
		for j, r := range roles {
			parsedRoles[j] = service.ParseRoleName(r)
		}

		studentID := ""
		if s.StudentID.Valid {
			studentID = uuid.UUID(s.StudentID.Bytes).String()
		}

		result[i] = studentResponse{
			ID:           s.ID.String(),
			Email:        s.Email,
			FullName:     s.FullName,
			AvatarUrl:    s.AvatarUrl,
			StudentID:    studentID,
			MatricNumber: s.MatricNumber,
			Level:        s.Level,
			Roles:        parsedRoles,
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"data":    result,
		"total":   total,
		"page":    page,
		"per_page": perPage,
	})
}

func (server *Server) listRoleAssignmentLogs(ctx *gin.Context) {
	limitStr := ctx.DefaultQuery("limit", "20")
	offsetStr := ctx.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(offsetStr)

	logs, err := server.roles.ListAllRoleLogs(ctx, int32(limit), int32(offset))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type logResponse struct {
		ID               string  `json:"id"`
		UserName         string  `json:"user_name"`
		UserID           string  `json:"user_id"`
		Role             string  `json:"role"`
		Action           string  `json:"action"`
		PerformedBy      string  `json:"performed_by_name"`
		PerformedByID    string  `json:"performed_by_id"`
		PerformedByRole  *string `json:"performed_by_role"`
		PreviousRoles    json.RawMessage `json:"previous_roles"`
		NewRoles         json.RawMessage `json:"new_roles"`
		Reason           *string `json:"reason"`
		IpAddress        *string `json:"ip_address"`
		CreatedAt        string  `json:"created_at"`
	}

	result := make([]logResponse, len(logs))
	for i, l := range logs {
		performedByName := ""
		if l.PerformedByName != nil {
			performedByName = *l.PerformedByName
		}
		userName := ""
		if l.TargetUserName != nil {
			userName = *l.TargetUserName
		}
		result[i] = logResponse{
			ID:               l.ID.String(),
			UserName:         userName,
			UserID:           l.UserID.String(),
			Role:             service.ParseRoleName(string(l.Role)),
			Action:           l.Action,
			PerformedBy:      performedByName,
			PerformedByID:    l.PerformedBy.String(),
			PerformedByRole:  l.PerformedByRole,
			PreviousRoles:    json.RawMessage(l.PreviousRoles),
			NewRoles:         json.RawMessage(l.NewRoles),
			Reason:           l.Reason,
			IpAddress:        l.IpAddress,
			CreatedAt:        l.CreatedAt.Time.Format("2006-01-02 15:04"),
		}
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) listRoleLogsByUser(ctx *gin.Context) {
	userID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	limitStr := ctx.DefaultQuery("limit", "20")
	offsetStr := ctx.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(offsetStr)

	logs, err := server.roles.ListRoleLogsByUser(ctx, userID, int32(limit), int32(offset))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type logResponse struct {
		ID              string          `json:"id"`
		Role            string          `json:"role"`
		Action          string          `json:"action"`
		PerformedBy     string          `json:"performed_by_name"`
		PerformedByRole *string         `json:"performed_by_role"`
		PreviousRoles   json.RawMessage `json:"previous_roles"`
		NewRoles        json.RawMessage `json:"new_roles"`
		Reason          *string         `json:"reason"`
		CreatedAt       string          `json:"created_at"`
	}

	result := make([]logResponse, len(logs))
	for i, l := range logs {
		performedByName := ""
		if l.PerformedByName != nil {
			performedByName = *l.PerformedByName
		}
		result[i] = logResponse{
			ID:              l.ID.String(),
			Role:            service.ParseRoleName(string(l.Role)),
			Action:          l.Action,
			PerformedBy:     performedByName,
			PerformedByRole: l.PerformedByRole,
			PreviousRoles:   json.RawMessage(l.PreviousRoles),
			NewRoles:        json.RawMessage(l.NewRoles),
			Reason:          l.Reason,
			CreatedAt:       l.CreatedAt.Time.Format("2006-01-02 15:04"),
		}
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) countStudentsWithAdditionalRoles(ctx *gin.Context) {
	count, err := server.roles.CountStudentsWithAdditionalRoles(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"count": count})
}

func (server *Server) promoteUser(ctx *gin.Context) {
	var req promoteUserRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	promotedBy := getUserID(ctx)

	ipAddress := ctx.ClientIP()
	userAgent := ctx.GetHeader("User-Agent")

	promotion, err := server.roles.PromoteUser(ctx, req.UserID, req.FromRole, req.ToRole, promotedBy, req.Reason, &ipAddress, &userAgent)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, promotion)
}

func (server *Server) listPromotions(ctx *gin.Context) {
	var limit int32 = 10
	var offset int32 = 0

	promotions, err := server.roles.ListPromotions(ctx, limit, offset)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, promotions)
}

func (server *Server) listPromotableStudents(ctx *gin.Context) {
	var limit int32 = 10
	var offset int32 = 0

	students, err := server.roles.ListPromotableStudents(ctx, limit, offset)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, students)
}

func (server *Server) listRoles(ctx *gin.Context) {
	roles, err := server.roles.ListAllSystemRoles(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": roles})
}

type createRoleRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

func (server *Server) createRole(ctx *gin.Context) {
	var req createRoleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": gin.H{
		"name":        req.Name,
		"description": req.Description,
		"permissions": req.Permissions,
		"isActive":    true,
	}})
}
