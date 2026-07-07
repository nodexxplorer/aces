-- name: GrantAdminPermissions :one
INSERT INTO admin_permissions (
    user_id,
    can_manage_results,
    can_manage_users,
    can_manage_finance,
    can_manage_courses,
    can_view_analytics,
    can_manage_announcements,
    can_backup_data,
    granted_by_hod_id,
    expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING *;

-- name: GetAdminPermissions :one
SELECT * FROM admin_permissions
WHERE user_id = $1 AND is_active = true;

-- name: UpdateAdminPermissions :one
UPDATE admin_permissions
SET 
    can_manage_results = $2,
    can_manage_users = $3,
    can_manage_finance = $4,
    can_manage_courses = $5,
    can_view_analytics = $6,
    can_manage_announcements = $7,
    can_backup_data = $8,
    expires_at = COALESCE($9, expires_at)
WHERE user_id = $1
RETURNING *;

-- name: RevokeAdminPermissions :exec
UPDATE admin_permissions
SET is_active = false
WHERE user_id = $1;

-- name: ListAdminPermissions :many
SELECT * FROM admin_permissions
WHERE is_active = true
ORDER BY granted_at DESC
LIMIT $1 OFFSET $2;
