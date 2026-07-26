-- Revert: remove matric_number column and restore NOT NULL on student_id
DROP TRIGGER IF EXISTS trg_link_pending_results ON students;
DROP FUNCTION IF EXISTS link_pending_results();
DROP INDEX IF EXISTS idx_results_matric_number;
ALTER TABLE results DROP COLUMN IF EXISTS matric_number;
ALTER TABLE results ALTER COLUMN student_id SET NOT NULL;
