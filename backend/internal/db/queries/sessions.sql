-- name: CreateSession :one
INSERT INTO sessions (
    name, start_date, end_date
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: GetSession :one
SELECT * FROM sessions
WHERE id = $1 LIMIT 1;

-- name: GetSessionByName :one
SELECT * FROM sessions
WHERE name = $1 LIMIT 1;

-- name: GetActiveSession :one
SELECT * FROM sessions
WHERE is_active = true LIMIT 1;

-- name: ListSessions :many
SELECT * FROM sessions
ORDER BY start_date DESC
LIMIT $1 OFFSET $2;

-- name: UpdateSession :one
UPDATE sessions
SET
    name = $2,
    start_date = $3,
    end_date = $4,
    is_active = $5,
    is_archived = $6
WHERE id = $1
RETURNING *;

-- name: DeleteSession :exec
DELETE FROM sessions
WHERE id = $1;
