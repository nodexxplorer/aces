-- name: CreateTranscriptRequest :one
INSERT INTO transcript_requests (
    student_id, purpose, status, fee_paid, fee_amount
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetTranscriptRequest :one
SELECT * FROM transcript_requests
WHERE id = $1 LIMIT 1;

-- name: ListStudentTranscriptRequests :many
SELECT * FROM transcript_requests
WHERE student_id = $1
ORDER BY created_at DESC;

-- name: ListPendingTranscriptRequests :many
SELECT * FROM transcript_requests
WHERE status = 'requested'
ORDER BY created_at ASC
LIMIT $1 OFFSET $2;

-- name: UpdateTranscriptRequest :one
UPDATE transcript_requests
SET
    status = $2,
    fee_paid = $3,
    pdf_url = $4,
    qr_code_url = $5,
    sent_via_email = $6,
    emailed_at = $7,
    processed_by = $8,
    processed_at = $9
WHERE id = $1
RETURNING *;

-- name: DeleteTranscriptRequest :exec
DELETE FROM transcript_requests
WHERE id = $1;
