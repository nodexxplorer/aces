-- Migration 000025: Security Fixes
-- Adds index for lecturer-course assignment lookup used by result entry authorization.

CREATE INDEX IF NOT EXISTS idx_lecturer_course_assignments_lookup
    ON lecturer_course_assignments (lecturer_id, course_id);
