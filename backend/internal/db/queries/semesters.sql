-- name: CreateSemester :one
INSERT INTO semesters (
    session_id, name, start_date, end_date, registration_deadline
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetSemester :one
SELECT * FROM semesters
WHERE id = $1 LIMIT 1;

-- name: GetActiveSemester :one
SELECT * FROM semesters
WHERE is_active = true LIMIT 1;

-- name: ListSessionSemesters :many
SELECT * FROM semesters
WHERE session_id = $1
ORDER BY start_date DESC;

-- name: UpdateSemester :one
UPDATE semesters
SET
    session_id = $2,
    name = $3,
    start_date = $4,
    end_date = $5,
    registration_deadline = $6,
    is_active = $7
WHERE id = $1
RETURNING *;

-- name: DeleteSemester :exec
DELETE FROM semesters
WHERE id = $1;
