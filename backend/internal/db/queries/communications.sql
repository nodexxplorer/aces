-- name: CreateAnnouncement :one
INSERT INTO announcements (
    title, content, is_pinned, target_level, target_audience, expires_at, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetAnnouncement :one
SELECT * FROM announcements
WHERE id = $1 LIMIT 1;

-- name: ListActiveAnnouncements :many
SELECT * FROM announcements
WHERE (expires_at IS NULL OR expires_at > NOW())
ORDER BY is_pinned DESC, created_at DESC
LIMIT $1 OFFSET $2;

-- name: UpdateAnnouncement :one
UPDATE announcements
SET
    title = $2,
    content = $3,
    is_pinned = $4,
    target_level = $5,
    target_audience = $6,
    expires_at = $7
WHERE id = $1
RETURNING *;

-- name: DeleteAnnouncement :exec
DELETE FROM announcements
WHERE id = $1;

-- name: CreateNotification :one
INSERT INTO notifications (
    user_id, type, title, message, action_url, email_sent, category, priority, sender_id, entity_type, entity_id, action_label, image_url, metadata
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
) RETURNING *;

-- name: GetNotification :one
SELECT * FROM notifications
WHERE id = $1 LIMIT 1;

-- name: ListUserNotifications :many
SELECT * FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListUserNotificationsByCategory :many
SELECT * FROM notifications
WHERE user_id = $1 AND category = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListUnreadUserNotifications :many
SELECT * FROM notifications
WHERE user_id = $1 AND is_read = false
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountUnreadNotifications :one
SELECT COUNT(*)::int FROM notifications
WHERE user_id = $1 AND is_read = false;

-- name: CountNotificationsByCategory :many
SELECT category, COUNT(*)::int as count FROM notifications
WHERE user_id = $1 AND is_read = false
GROUP BY category;

-- name: MarkNotificationAsRead :one
UPDATE notifications
SET is_read = true
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: MarkAllUserNotificationsAsRead :exec
UPDATE notifications
SET is_read = true
WHERE user_id = $1 AND is_read = false;

-- name: DeleteNotification :exec
DELETE FROM notifications
WHERE id = $1 AND user_id = $2;

-- name: DeleteExpiredNotifications :exec
DELETE FROM notifications
WHERE expires_at IS NOT NULL AND expires_at < NOW();

-- name: BroadcastNotification :many
INSERT INTO notifications (
    user_id, type, title, message, action_url, email_sent, category, priority, sender_id, entity_type, entity_id, action_label, image_url, metadata
)
SELECT
    u.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
FROM users u
WHERE
    ($15::text = 'all' OR ($15::text = 'role' AND u.role = ANY(SELECT jsonb_array_elements_text($16::jsonb))))
    AND ($17::int = 0 OR u.level = $17)
    AND u.is_approved = true
    AND u.is_active = true
RETURNING *;

-- name: GetNotificationPreferences :one
SELECT * FROM notification_preferences
WHERE user_id = $1 LIMIT 1;

-- name: UpsertNotificationPreferences :one
INSERT INTO notification_preferences (
    user_id, email_enabled, push_enabled, in_app_enabled,
    email_auth, email_results, email_dues, email_messages, email_connect, email_skills, email_alumni, email_system,
    push_auth, push_results, push_dues, push_messages, push_connect, push_skills, push_alumni, push_system,
    quiet_hours_start, quiet_hours_end
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
)
ON CONFLICT (user_id) DO UPDATE SET
    email_enabled = EXCLUDED.email_enabled,
    push_enabled = EXCLUDED.push_enabled,
    in_app_enabled = EXCLUDED.in_app_enabled,
    email_auth = EXCLUDED.email_auth,
    email_results = EXCLUDED.email_results,
    email_dues = EXCLUDED.email_dues,
    email_messages = EXCLUDED.email_messages,
    email_connect = EXCLUDED.email_connect,
    email_skills = EXCLUDED.email_skills,
    email_alumni = EXCLUDED.email_alumni,
    email_system = EXCLUDED.email_system,
    push_auth = EXCLUDED.push_auth,
    push_results = EXCLUDED.push_results,
    push_dues = EXCLUDED.push_dues,
    push_messages = EXCLUDED.push_messages,
    push_connect = EXCLUDED.push_connect,
    push_skills = EXCLUDED.push_skills,
    push_alumni = EXCLUDED.push_alumni,
    push_system = EXCLUDED.push_system,
    quiet_hours_start = EXCLUDED.quiet_hours_start,
    quiet_hours_end = EXCLUDED.quiet_hours_end,
    updated_at = NOW()
RETURNING *;

-- name: CreateNotificationForUser :one
INSERT INTO notifications (
    user_id, type, title, message, action_url, email_sent, category, priority, sender_id, entity_type, entity_id, action_label, image_url, metadata
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
) RETURNING *;
