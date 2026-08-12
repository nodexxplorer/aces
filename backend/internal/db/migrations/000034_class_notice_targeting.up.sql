ALTER TABLE class_notices ADD COLUMN level INT;
ALTER TABLE class_notices ADD COLUMN target_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX idx_class_notices_level ON class_notices(level);
