-- Enhance notifications table with category, priority, targeting, and metadata
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'general';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_label VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_category ON notifications(user_id, category);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    email_auth BOOLEAN DEFAULT true,
    email_results BOOLEAN DEFAULT true,
    email_dues BOOLEAN DEFAULT true,
    email_messages BOOLEAN DEFAULT true,
    email_connect BOOLEAN DEFAULT false,
    email_skills BOOLEAN DEFAULT false,
    email_alumni BOOLEAN DEFAULT true,
    email_system BOOLEAN DEFAULT true,
    push_auth BOOLEAN DEFAULT true,
    push_results BOOLEAN DEFAULT true,
    push_dues BOOLEAN DEFAULT true,
    push_messages BOOLEAN DEFAULT true,
    push_connect BOOLEAN DEFAULT true,
    push_skills BOOLEAN DEFAULT true,
    push_alumni BOOLEAN DEFAULT true,
    push_system BOOLEAN DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
