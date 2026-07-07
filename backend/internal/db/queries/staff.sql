-- name: CreateStaff :one
INSERT INTO staff (
    user_id, staff_id, department, rank, specialization, employment_date
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetStaff :one
SELECT * FROM staff
WHERE id = $1 LIMIT 1;

-- name: GetStaffByUserID :one
SELECT * FROM staff
WHERE user_id = $1 LIMIT 1;

-- name: GetStaffByStaffID :one
SELECT * FROM staff
WHERE staff_id = $1 LIMIT 1;

-- name: ListStaff :many
SELECT * FROM staff
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: UpdateStaff :one
UPDATE staff
SET
    department = $2,
    rank = $3,
    specialization = $4,
    employment_date = COALESCE($5, employment_date)
WHERE id = $1
RETURNING *;

-- name: DeleteStaff :exec
DELETE FROM staff
WHERE id = $1;
