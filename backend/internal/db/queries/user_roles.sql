-- ==================== USER ROLES ====================

-- name: CreateUserRole :one
INSERT INTO user_role_assignments (
    user_id, role, is_active, assigned_by
) VALUES (
    $1, $2, true, $3
) RETURNING *;

-- name: GetUserRole :one
SELECT * FROM user_role_assignments
WHERE id = $1 LIMIT 1;

-- name: ListUserRoles :many
SELECT * FROM user_role_assignments
WHERE user_id = $1 AND is_active = true
ORDER BY assigned_at DESC;

-- name: RevokeUserRole :one
UPDATE user_role_assignments
SET is_active = false, revoked_at = NOW()
WHERE user_id = $1 AND role = $2 AND is_active = true
RETURNING *;

-- name: CheckUserHasRole :one
SELECT EXISTS(
    SELECT 1 FROM user_role_assignments
    WHERE user_id = $1 AND role = $2 AND is_active = true
) AS has_role;

-- ==================== ROLE PROMOTIONS ====================

-- name: CreateRolePromotion :one
INSERT INTO role_promotions (
    user_id, from_role, to_role, promoted_by, reason, ip_address, user_agent
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: ListRolePromotions :many
SELECT * FROM role_promotions
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListUserRolePromotions :many
SELECT * FROM role_promotions
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: ListPromotableStudents :many
SELECT s.*, u.full_name, u.email, u.role
FROM students s
JOIN users u ON s.user_id = u.id
WHERE u.is_approved = true AND u.is_active = true
ORDER BY s.level, u.full_name
LIMIT $1 OFFSET $2;

-- ==================== ROLE ASSIGNMENT LOGS ====================

-- name: CreateRoleAssignmentLog :one
INSERT INTO role_assignment_logs (
    user_id, role, action, performed_by, performed_by_role, previous_roles, new_roles, reason, ip_address
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: ListRoleAssignmentLogsByUser :many
SELECT ral.*, u.full_name as performed_by_name
FROM role_assignment_logs ral
LEFT JOIN users u ON ral.performed_by = u.id
WHERE ral.user_id = $1
ORDER BY ral.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAllRoleAssignmentLogs :many
SELECT ral.*, u.full_name as performed_by_name, tu.full_name as target_user_name
FROM role_assignment_logs ral
LEFT JOIN users u ON ral.performed_by = u.id
LEFT JOIN users tu ON ral.user_id = tu.id
ORDER BY ral.created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountStudentsWithAdditionalRoles :one
SELECT COUNT(DISTINCT ura.user_id)::int
FROM user_role_assignments ura
JOIN users u ON ura.user_id = u.id
WHERE ura.is_active = true AND u.is_approved = true AND u.is_active = true;

-- name: ListStudentsForRoleManagement :many
SELECT u.id, u.email, u.full_name, u.avatar_url, u.is_active, u.is_approved, u.created_at::text,
    s.id as student_id, s.matric_number, s.level,
    COALESCE(
        (SELECT string_agg(DISTINCT ura.role::text, ',')
         FROM user_role_assignments ura
         WHERE ura.user_id = u.id AND ura.is_active = true),
        u.role::text
    ) as all_roles
FROM users u
LEFT JOIN students s ON s.user_id = u.id
WHERE u.is_approved = true AND u.is_active = true
    AND u.role = 'student'
    AND ($1::text = '' OR
         LOWER(u.full_name) LIKE '%' || LOWER($1) || '%' OR
         LOWER(u.email) LIKE '%' || LOWER($1) || '%' OR
         LOWER(s.matric_number) LIKE '%' || LOWER($1) || '%')
ORDER BY u.full_name ASC
LIMIT $2 OFFSET $3;

-- name: CountStudentsForRoleManagement :one
SELECT COUNT(*)::int
FROM users u
LEFT JOIN students s ON s.user_id = u.id
WHERE u.is_approved = true AND u.is_active = true
    AND u.role = 'student'
    AND ($1::text = '' OR
         LOWER(u.full_name) LIKE '%' || LOWER($1) || '%' OR
         LOWER(u.email) LIKE '%' || LOWER($1) || '%' OR
         LOWER(s.matric_number) LIKE '%' || LOWER($1) || '%');
