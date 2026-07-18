-- name: CreateSignupApproval :one
INSERT INTO signup_approvals (
    user_id, signup_type, reg_no, level, status
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetSignupApproval :one
SELECT * FROM signup_approvals
WHERE id = $1 LIMIT 1;

-- name: GetSignupApprovalByUserId :one
SELECT * FROM signup_approvals
WHERE user_id = $1 LIMIT 1;

-- name: ListPendingSignupApprovals :many
SELECT * FROM signup_approvals
WHERE status = 'pending'
ORDER BY created_at ASC;

-- name: ListPendingSignupApprovalsByType :many
SELECT * FROM signup_approvals
WHERE status = 'pending' AND signup_type = $1
ORDER BY created_at ASC;

-- name: ListPendingSignupApprovalsByLevel :many
SELECT * FROM signup_approvals
WHERE status = 'pending' AND level = $1
ORDER BY created_at ASC;

-- name: UpdateSignupApproval :one
UPDATE signup_approvals
SET
    status = $2,
    approved_by = $3,
    approved_at = $4,
    rejection_reason = $5
WHERE id = $1
RETURNING *;
