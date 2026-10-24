-- name: GrantAdminPermissions :one
-- Creates or replaces the grant for one person. A person has at most one grant
-- per department, so a grant that was revoked earlier is reactivated here.
INSERT INTO admin_permissions (
    user_id,
    can_manage_results,
    can_manage_users,
    can_manage_finance,
    can_manage_courses,
    can_view_analytics,
    can_manage_announcements,
    can_backup_data,
    can_manage_complaints,
    can_manage_alumni,
    can_manage_course_forms,
    can_manage_settings,
    granted_by_hod_id,
    expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    can_manage_results = EXCLUDED.can_manage_results,
    can_manage_users = EXCLUDED.can_manage_users,
    can_manage_finance = EXCLUDED.can_manage_finance,
    can_manage_courses = EXCLUDED.can_manage_courses,
    can_view_analytics = EXCLUDED.can_view_analytics,
    can_manage_announcements = EXCLUDED.can_manage_announcements,
    can_backup_data = EXCLUDED.can_backup_data,
    can_manage_complaints = EXCLUDED.can_manage_complaints,
    can_manage_alumni = EXCLUDED.can_manage_alumni,
    can_manage_course_forms = EXCLUDED.can_manage_course_forms,
    can_manage_settings = EXCLUDED.can_manage_settings,
    granted_by_hod_id = EXCLUDED.granted_by_hod_id,
    granted_at = NOW(),
    expires_at = EXCLUDED.expires_at,
    is_active = true
RETURNING *;

-- name: GetAdminPermissions :one
-- The active grant for a person. A grant counts only while the person still
-- holds the delegated admin role, so a grant left behind by a removed role
-- never works again.
SELECT ap.* FROM admin_permissions ap
WHERE ap.user_id = $1
  AND ap.is_active = true
  AND (ap.expires_at IS NULL OR ap.expires_at > NOW())
  AND (
    EXISTS (SELECT 1 FROM users u WHERE u.id = ap.user_id AND u.role = 'admin')
    OR EXISTS (
        SELECT 1 FROM user_role_assignments ura
        WHERE ura.user_id = ap.user_id AND ura.role = 'admin' AND ura.is_active = true
    )
  );

-- name: UserHoldsAdminRole :one
-- True when the person holds the delegated admin role, by primary role or by an
-- active extra role. Grants can only be given to such a person.
SELECT (
    EXISTS (SELECT 1 FROM users u WHERE u.id = $1 AND u.role = 'admin')
    OR EXISTS (
        SELECT 1 FROM user_role_assignments ura
        WHERE ura.user_id = $1 AND ura.role = 'admin' AND ura.is_active = true
    )
) AS holds_role;

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
    can_manage_complaints = $9,
    can_manage_alumni = $10,
    can_manage_course_forms = $11,
    can_manage_settings = $12,
    expires_at = COALESCE($13, expires_at)
WHERE user_id = $1 AND is_active = true
RETURNING *;

-- name: RevokeAdminPermissions :exec
-- Turns every flag off as well as deactivating the grant, so a later grant starts
-- from a clean state.
UPDATE admin_permissions
SET
    is_active = false,
    can_manage_results = false,
    can_manage_users = false,
    can_manage_finance = false,
    can_manage_courses = false,
    can_view_analytics = false,
    can_manage_announcements = false,
    can_backup_data = false,
    can_manage_complaints = false,
    can_manage_alumni = false,
    can_manage_course_forms = false,
    can_manage_settings = false
WHERE user_id = $1;

-- name: ListAdminPermissions :many
SELECT * FROM admin_permissions
WHERE is_active = true
ORDER BY granted_at DESC
LIMIT $1 OFFSET $2;
