DROP INDEX IF EXISTS idx_class_notices_level;
ALTER TABLE class_notices DROP COLUMN target_user_ids;
ALTER TABLE class_notices DROP COLUMN level;
