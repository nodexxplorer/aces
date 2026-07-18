-- ==================== CONNECTIONS ====================

-- name: CreateConnection :one
INSERT INTO connections (
    requester_id, receiver_id, message
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: GetConnection :one
SELECT * FROM connections
WHERE id = $1 LIMIT 1;

-- name: ListUserConnections :many
SELECT c.*, u.full_name, u.avatar_url, u.role
FROM connections c
JOIN users u ON (
    CASE WHEN c.requester_id = $1 THEN c.receiver_id ELSE c.requester_id END
) = u.id
WHERE (c.requester_id = $1 OR c.receiver_id = $1) AND c.status = 'accepted'
ORDER BY c.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListPendingConnectionRequests :many
SELECT c.*, u.full_name, u.avatar_url, u.role
FROM connections c
JOIN users u ON c.requester_id = u.id
WHERE c.receiver_id = $1 AND c.status = 'pending'
ORDER BY c.created_at DESC;

-- name: UpdateConnectionStatus :one
UPDATE connections
SET status = $2, responded_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CheckConnectionExists :one
SELECT EXISTS(
    SELECT 1 FROM connections
    WHERE (requester_id = $1 AND receiver_id = $2)
       OR (requester_id = $2 AND receiver_id = $1)
) AS connection_exists;

-- ==================== MESSAGES ====================

-- name: CreateMessage :one
INSERT INTO messages (
    sender_id, receiver_id, content
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: ListConversation :many
SELECT * FROM messages
WHERE (sender_id = $1 AND receiver_id = $2)
   OR (sender_id = $2 AND receiver_id = $1)
ORDER BY created_at ASC
LIMIT $3 OFFSET $4;

-- name: MarkMessageRead :one
UPDATE messages
SET is_read = true, read_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CountUnreadMessages :one
SELECT COUNT(*) AS unread_count
FROM messages
WHERE receiver_id = $1 AND is_read = false;

-- ==================== GROUPS ====================

-- name: CreateGroup :one
INSERT INTO groups (
    name, description, category, avatar_url, max_members, is_private, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetGroup :one
SELECT * FROM groups
WHERE id = $1 LIMIT 1;

-- name: ListGroups :many
SELECT g.*, COUNT(gm.id) AS member_count
FROM groups g
LEFT JOIN group_members gm ON g.id = gm.group_id
WHERE g.is_private = false
GROUP BY g.id
ORDER BY g.created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListUserGroups :many
SELECT g.*, gm.role AS member_role
FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = $1
ORDER BY g.name;

-- name: UpdateGroup :one
UPDATE groups
SET name = $2, description = $3, category = $4, avatar_url = $5,
    max_members = $6, is_private = $7, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteGroup :exec
DELETE FROM groups WHERE id = $1;

-- ==================== GROUP MEMBERS ====================

-- name: AddGroupMember :one
INSERT INTO group_members (
    group_id, user_id, role
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: ListGroupMembers :many
SELECT gm.*, u.full_name, u.avatar_url, u.email
FROM group_members gm
JOIN users u ON gm.user_id = u.id
WHERE gm.group_id = $1
ORDER BY gm.role, u.full_name;

-- name: UpdateGroupMemberRole :one
UPDATE group_members
SET role = $3
WHERE group_id = $1 AND user_id = $2
RETURNING *;

-- name: RemoveGroupMember :exec
DELETE FROM group_members
WHERE group_id = $1 AND user_id = $2;

-- name: CheckGroupMembership :one
SELECT EXISTS(
    SELECT 1 FROM group_members
    WHERE group_id = $1 AND user_id = $2
) AS is_member;

-- ==================== GROUP MESSAGES ====================

-- name: CreateGroupMessage :one
INSERT INTO group_messages (
    group_id, sender_id, content
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: ListGroupMessages :many
SELECT gm.*, u.full_name, u.avatar_url
FROM group_messages gm
JOIN users u ON gm.sender_id = u.id
WHERE gm.group_id = $1
ORDER BY gm.created_at ASC
LIMIT $2 OFFSET $3;

-- name: GetStudentDirectory :many
SELECT u.id, u.full_name, u.avatar_url, u.email, s.matric_number, s.level
FROM users u
JOIN students s ON u.id = s.user_id
WHERE u.is_active = true AND u.is_approved = true
ORDER BY u.full_name
LIMIT $1 OFFSET $2;

-- name: GetAlumniDirectory :many
SELECT u.id, u.full_name, u.avatar_url, u.email,
       als.graduation_year, als.current_company, als.current_position, als.is_mentor_available
FROM users u
JOIN alumni_status als ON u.id = als.user_id
WHERE u.is_active = true AND als.verification_status = 'verified'
ORDER BY u.full_name
LIMIT $1 OFFSET $2;
