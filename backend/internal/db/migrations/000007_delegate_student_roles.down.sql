-- 000007_delegate_student_roles.down.sql

DROP TABLE IF EXISTS role_assignment_logs;

-- Note: PostgreSQL does not support removing values from an enum.
-- The new values (project_coordinator, event_coordinator, alumni_rep) will remain
-- but become unused. A full enum recreation would be needed to truly remove them.
