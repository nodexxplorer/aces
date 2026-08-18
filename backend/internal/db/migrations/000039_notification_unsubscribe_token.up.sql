ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64) UNIQUE;
