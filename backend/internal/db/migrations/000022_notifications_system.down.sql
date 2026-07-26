DROP TABLE IF EXISTS notification_preferences;

DROP INDEX IF EXISTS idx_notifications_entity;
DROP INDEX IF EXISTS idx_notifications_user_created;
DROP INDEX IF EXISTS idx_notifications_user_category;
DROP INDEX IF EXISTS idx_notifications_user_read;

ALTER TABLE notifications DROP COLUMN IF EXISTS expires_at;
ALTER TABLE notifications DROP COLUMN IF EXISTS metadata;
ALTER TABLE notifications DROP COLUMN IF EXISTS image_url;
ALTER TABLE notifications DROP COLUMN IF EXISTS action_label;
ALTER TABLE notifications DROP COLUMN IF EXISTS entity_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS entity_type;
ALTER TABLE notifications DROP COLUMN IF EXISTS sender_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS priority;
ALTER TABLE notifications DROP COLUMN IF EXISTS category;
