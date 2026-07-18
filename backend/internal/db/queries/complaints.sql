-- name: CreateComplaint :one
INSERT INTO complaints (
    student_id, category, subject, body, priority, status
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetComplaint :one
SELECT * FROM complaints
WHERE id = $1 LIMIT 1;

-- name: ListComplaints :many
SELECT * FROM complaints
ORDER BY created_at DESC;

-- name: ListStudentComplaints :many
SELECT * FROM complaints
WHERE student_id = $1
ORDER BY created_at DESC;

-- name: UpdateComplaint :one
UPDATE complaints
SET
    category = $2,
    subject = $3,
    body = $4,
    priority = $5,
    status = $6,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteComplaint :exec
DELETE FROM complaints
WHERE id = $1;
