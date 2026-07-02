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
    user_id, type, title, message, action_url, email_sent
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetNotification :one
SELECT * FROM notifications
WHERE id = $1 LIMIT 1;

-- name: ListUserNotifications :many
SELECT * FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

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
