-- The grants made since the up migration are kept in the original seven flags.
-- Only the four flags added by the up migration are removed.
ALTER TABLE admin_permissions
    DROP COLUMN IF EXISTS can_manage_settings,
    DROP COLUMN IF EXISTS can_manage_course_forms,
    DROP COLUMN IF EXISTS can_manage_alumni,
    DROP COLUMN IF EXISTS can_manage_complaints;
