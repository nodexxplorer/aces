-- Per-person grants for delegated admins are now enforced. Each admin area has
-- one flag in admin_permissions. Seven flags already exist; these four cover the
-- admin areas that had none: complaints, alumni, course forms and settings.
ALTER TABLE admin_permissions
    ADD COLUMN can_manage_complaints BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN can_manage_alumni BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN can_manage_course_forms BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN can_manage_settings BOOLEAN NOT NULL DEFAULT false;

-- Until now every delegated admin had the whole admin area. Keep that for everyone
-- who holds the role when this runs, so nobody loses access on deploy. A HOD can
-- narrow any grant afterwards. granted_by_hod_id is NOT NULL, so use the person
-- who assigned the role, or else the department's first HOD, or else the person
-- themselves when the department has no HOD.
WITH holders AS (
    SELECT u.id AS user_id, u.tenant_id
    FROM users u
    WHERE u.role = 'admin'
    UNION
    SELECT ura.user_id, ura.tenant_id
    FROM user_role_assignments ura
    WHERE ura.role = 'admin' AND ura.is_active = true
)
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
    is_active,
    tenant_id
)
SELECT
    h.user_id,
    true, true, true, true, true, true, true, true, true, true, true,
    COALESCE(
        (SELECT ura.assigned_by
           FROM user_role_assignments ura
          WHERE ura.user_id = h.user_id AND ura.role = 'admin'
            AND ura.is_active = true AND ura.assigned_by IS NOT NULL
          LIMIT 1),
        (SELECT hod.id
           FROM users hod
          WHERE hod.tenant_id = h.tenant_id AND hod.role = 'hod'
          ORDER BY hod.created_at, hod.id
          LIMIT 1),
        h.user_id
    ),
    true,
    h.tenant_id
FROM holders h
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    can_manage_results = true,
    can_manage_users = true,
    can_manage_finance = true,
    can_manage_courses = true,
    can_view_analytics = true,
    can_manage_announcements = true,
    can_backup_data = true,
    can_manage_complaints = true,
    can_manage_alumni = true,
    can_manage_course_forms = true,
    can_manage_settings = true,
    is_active = true;
