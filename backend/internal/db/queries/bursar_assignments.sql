-- ==================== BURSAR ASSIGNMENTS ====================

-- name: CreateBursarAssignment :one
INSERT INTO bursar_assignments (
    user_id, level, bursar_type, session_id, assigned_by
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetBursarAssignment :one
SELECT * FROM bursar_assignments
WHERE id = $1 LIMIT 1;

-- name: ListActiveBursarAssignments :many
SELECT * FROM bursar_assignments
WHERE is_active = true
ORDER BY level, bursar_type;

-- name: ListBursarAssignmentsByUser :many
SELECT * FROM bursar_assignments
WHERE user_id = $1 AND is_active = true;

-- name: RevokeBursarAssignment :one
UPDATE bursar_assignments
SET is_active = false, revoked_at = NOW()
WHERE id = $1
RETURNING *;
