package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type RoleService struct {
	store db.Querier
}

func NewRoleService(store db.Querier) *RoleService {
	return &RoleService{store: store}
}

func (s *RoleService) AssignRole(ctx context.Context, userID uuid.UUID, role db.UserRole, assignedBy uuid.UUID) (db.UserRoleAssignment, error) {
	hasRole, err := s.store.CheckUserHasRole(ctx, db.CheckUserHasRoleParams{
		UserID: userID,
		Role:   role,
	})
	if err == nil && hasRole {
		return db.UserRoleAssignment{}, errors.New("user already has this role")
	}

	assignment, err := s.store.CreateUserRole(ctx, db.CreateUserRoleParams{
		UserID:     userID,
		Role:       role,
		AssignedBy: pgtype.UUID{Bytes: assignedBy, Valid: true},
	})
	if err != nil {
		return db.UserRoleAssignment{}, errors.New("failed to assign role: " + err.Error())
	}

	return assignment, nil
}

func (s *RoleService) RevokeRole(ctx context.Context, userID uuid.UUID, role db.UserRole) (db.UserRoleAssignment, error) {
	return s.store.RevokeUserRole(ctx, db.RevokeUserRoleParams{
		UserID: userID,
		Role:   role,
	})
}

func (s *RoleService) ListUserRoles(ctx context.Context, userID uuid.UUID) ([]db.UserRoleAssignment, error) {
	return s.store.ListUserRoles(ctx, userID)
}

// AssignRoleWithAudit assigns a role and creates an audit log entry.
func (s *RoleService) AssignRoleWithAudit(ctx context.Context, userID uuid.UUID, role db.UserRole, assignedBy uuid.UUID, performedByRole string, ipAddress string, reason *string) (db.UserRoleAssignment, error) {
	// Get previous roles
	previousRoles, _ := s.getUserRoleNames(ctx, userID)

	assignment, err := s.AssignRole(ctx, userID, role, assignedBy)
	if err != nil {
		return assignment, err
	}

	// Get new roles
	newRoles, _ := s.getUserRoleNames(ctx, userID)

	previousJSON, _ := json.Marshal(previousRoles)
	newJSON, _ := json.Marshal(newRoles)

	s.store.CreateRoleAssignmentLog(ctx, db.CreateRoleAssignmentLogParams{
		UserID:          userID,
		Role:            role,
		Action:          "assigned",
		PerformedBy:     assignedBy,
		PerformedByRole: &performedByRole,
		PreviousRoles:   previousJSON,
		NewRoles:        newJSON,
		Reason:          reason,
		IpAddress:       &ipAddress,
	})

	return assignment, nil
}

// RevokeRoleWithAudit revokes a role and creates an audit log entry.
func (s *RoleService) RevokeRoleWithAudit(ctx context.Context, userID uuid.UUID, role db.UserRole, revokedBy uuid.UUID, performedByRole string, ipAddress string, reason *string) (db.UserRoleAssignment, error) {
	previousRoles, _ := s.getUserRoleNames(ctx, userID)

	assignment, err := s.RevokeRole(ctx, userID, role)
	if err != nil {
		return assignment, err
	}

	newRoles, _ := s.getUserRoleNames(ctx, userID)

	previousJSON, _ := json.Marshal(previousRoles)
	newJSON, _ := json.Marshal(newRoles)

	s.store.CreateRoleAssignmentLog(ctx, db.CreateRoleAssignmentLogParams{
		UserID:          userID,
		Role:            role,
		Action:          "removed",
		PerformedBy:     revokedBy,
		PerformedByRole: &performedByRole,
		PreviousRoles:   previousJSON,
		NewRoles:        newJSON,
		Reason:          reason,
		IpAddress:       &ipAddress,
	})

	return assignment, nil
}

func (s *RoleService) getUserRoleNames(ctx context.Context, userID uuid.UUID) ([]string, error) {
	roles, err := s.store.ListUserRoles(ctx, userID)
	if err != nil {
		return nil, err
	}
	names := []string{"student"}
	for _, r := range roles {
		names = append(names, string(r.Role))
	}
	return names, nil
}

func (s *RoleService) SearchStudentsForRoleManagement(ctx context.Context, search string, limit, offset int32) ([]db.ListStudentsForRoleManagementRow, int32, error) {
	students, err := s.store.ListStudentsForRoleManagement(ctx, db.ListStudentsForRoleManagementParams{
		Column1: search,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		return nil, 0, err
	}

	count, err := s.store.CountStudentsForRoleManagement(ctx, search)
	if err != nil {
		count = 0
	}

	return students, count, nil
}

func (s *RoleService) ListRoleLogsByUser(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]db.ListRoleAssignmentLogsByUserRow, error) {
	return s.store.ListRoleAssignmentLogsByUser(ctx, db.ListRoleAssignmentLogsByUserParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
}

func (s *RoleService) ListAllRoleLogs(ctx context.Context, limit, offset int32) ([]db.ListAllRoleAssignmentLogsRow, error) {
	return s.store.ListAllRoleAssignmentLogs(ctx, db.ListAllRoleAssignmentLogsParams{
		Limit:  limit,
		Offset: offset,
	})
}

func (s *RoleService) CountStudentsWithAdditionalRoles(ctx context.Context) (int32, error) {
	return s.store.CountStudentsWithAdditionalRoles(ctx)
}

func (s *RoleService) ListUserRolesByName(ctx context.Context, userID uuid.UUID) ([]string, error) {
	return s.getUserRoleNames(ctx, userID)
}

func (s *RoleService) PromoteUser(ctx context.Context, userID uuid.UUID, fromRole *db.UserRole, toRole db.UserRole, promotedBy uuid.UUID, reason, ipAddress, userAgent *string) (db.RolePromotion, error) {
	_, err := s.AssignRole(ctx, userID, toRole, promotedBy)
	if err != nil {
		return db.RolePromotion{}, errors.New("failed to promote: " + err.Error())
	}

	promotion, err := s.store.CreateRolePromotion(ctx, db.CreateRolePromotionParams{
		UserID:     userID,
		FromRole:   fromRole,
		ToRole:     toRole,
		PromotedBy: promotedBy,
		Reason:     reason,
		IpAddress:  ipAddress,
		UserAgent:  userAgent,
	})
	if err != nil {
		return db.RolePromotion{}, errors.New("failed to record promotion: " + err.Error())
	}

	return promotion, nil
}

func (s *RoleService) ListPromotions(ctx context.Context, limit, offset int32) ([]db.RolePromotion, error) {
	return s.store.ListRolePromotions(ctx, db.ListRolePromotionsParams{
		Limit:  limit,
		Offset: offset,
	})
}

func (s *RoleService) ListPromotableStudents(ctx context.Context, limit, offset int32) ([]db.ListPromotableStudentsRow, error) {
	return s.store.ListPromotableStudents(ctx, db.ListPromotableStudentsParams{
		Limit:  limit,
		Offset: offset,
	})
}

type SystemRoleInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	UserCount   int    `json:"userCount"`
	IsActive    bool   `json:"isActive"`
}

func (s *RoleService) ListAllSystemRoles(ctx context.Context) ([]SystemRoleInfo, error) {
	roles := []SystemRoleInfo{
		{Name: "hod", Description: "Head of Department", IsActive: true},
		{Name: "delegated_admin", Description: "Delegated Administrator", IsActive: true},
		{Name: "admin", Description: "System Administrator", IsActive: true},
		{Name: "lecturer", Description: "Lecturer", IsActive: true},
		{Name: "class_rep", Description: "Class Representative", IsActive: true},
		{Name: "student", Description: "Student", IsActive: true},
		{Name: "class_bursar", Description: "Class Bursar", IsActive: true},
		{Name: "dept_bursar", Description: "Departmental Bursar", IsActive: true},
		{Name: "project_coordinator", Description: "Project Coordinator", IsActive: true},
		{Name: "event_coordinator", Description: "Event Coordinator", IsActive: true},
		{Name: "alumni_rep", Description: "Alumni Representative", IsActive: true},
		{Name: "alumni", Description: "Alumni", IsActive: true},
	}

	allUsers, err := s.store.ListUsers(ctx, db.ListUsersParams{Limit: 10000, Offset: 0})
	if err != nil {
		return roles, nil
	}

	counts := map[string]int{}
	for _, u := range allUsers {
		role := string(u.Role)
		counts[role]++
	}

	for i := range roles {
		roles[i].UserCount = counts[roles[i].Name]
	}

	return roles, nil
}

// ParseRoleName converts DB role names to frontend-compatible names.
func ParseRoleName(dbRole string) string {
	switch dbRole {
	case "bursar_dept":
		return "dept_bursar"
	case "bursar_class":
		return "class_bursar"
	default:
		return dbRole
	}
}

// ParseRoleNameReverse converts frontend role names to DB role names.
func ParseRoleNameReverse(frontendRole string) string {
	switch frontendRole {
	case "dept_bursar":
		return "bursar_dept"
	case "class_bursar":
		return "bursar_class"
	default:
		return frontendRole
	}
}

// ParseAllRoles parses a comma-separated role string into individual role names.
func ParseAllRoles(roleStr string) []string {
	if roleStr == "" {
		return []string{"student"}
	}
	parts := strings.Split(roleStr, ",")
	seen := map[string]bool{}
	result := []string{}
	for _, p := range parts {
		name := strings.TrimSpace(p)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		result = append(result, name)
	}
	if len(result) == 0 {
		return []string{"student"}
	}
	return result
}

// FormatRolesAsJSON converts a role list to JSON bytes for the audit log.
func FormatRolesAsJSON(roles []string) []byte {
	b, _ := json.Marshal(roles)
	return b
}

func init() {
	_ = fmt.Sprintf
}
