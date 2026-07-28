-- Migration 000025: Security Fixes (down)

DROP INDEX IF EXISTS idx_lecturer_course_assignments_lookup;
