-- name: CreateProfileUpdateRequest :one
INSERT INTO profile_update_requests (
    student_id, field_name, old_value, new_value, status
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetProfileUpdateRequest :one
SELECT * FROM profile_update_requests
WHERE id = $1 LIMIT 1;

-- name: ListStudentProfileUpdateRequests :many
SELECT * FROM profile_update_requests
WHERE student_id = $1
ORDER BY created_at DESC;

-- name: ListPendingProfileUpdateRequests :many
SELECT * FROM profile_update_requests
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT $1 OFFSET $2;

-- name: UpdateProfileUpdateRequestStatus :one
UPDATE profile_update_requests
SET
    status = $2,
    approved_by = $3,
    approved_at = $4,
    rejection_reason = $5
WHERE id = $1
RETURNING *;

-- name: DeleteProfileUpdateRequest :exec
DELETE FROM profile_update_requests
WHERE id = $1;
