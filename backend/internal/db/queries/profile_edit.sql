-- name: CreateProfileEditLog :one
INSERT INTO profile_edit_logs (
    student_id, field_name, old_value, new_value, changed_by, changed_by_role, change_type, reason, ip_address, request_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING *;

-- name: ListProfileEditLogsByStudent :many
SELECT * FROM profile_edit_logs
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAllProfileEditLogs :many
SELECT pel.*, u.full_name as changed_by_name
FROM profile_edit_logs pel
JOIN users u ON pel.changed_by = u.id
ORDER BY pel.created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountProfileEditLogsByStudent :one
SELECT COUNT(*)::int FROM profile_edit_logs
WHERE student_id = $1;

-- name: CreateStudentDocument :one
INSERT INTO student_documents (
    student_id, doc_type, file_url, file_name, file_size, uploaded_by, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetStudentDocument :one
SELECT * FROM student_documents
WHERE id = $1 LIMIT 1;

-- name: ListStudentDocumentsByStudent :many
SELECT * FROM student_documents
WHERE student_id = $1
ORDER BY created_at DESC;

-- name: ListStudentDocumentsByStatus :many
SELECT sd.*, u.full_name as student_name, s.matric_number
FROM student_documents sd
JOIN students s ON sd.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE sd.status = $1
ORDER BY sd.created_at DESC
LIMIT $2 OFFSET $3;

-- name: VerifyStudentDocument :one
UPDATE student_documents
SET status = 'verified', verified_by = $2, verified_at = NOW(), updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: RejectStudentDocument :one
UPDATE student_documents
SET status = 'rejected', verified_by = $2, rejection_reason = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CountStudentDocumentsByStatus :one
SELECT COUNT(*)::int FROM student_documents
WHERE status = $1;

-- name: UpdateStudentFullProfile :one
UPDATE students
SET level = COALESCE($2, level),
    current_session_id = COALESCE($3, current_session_id),
    current_semester = COALESCE($4, current_semester),
    academic_standing = COALESCE($5, academic_standing),
    graduation_status = COALESCE($6, graduation_status),
    admission_mode = COALESCE($7, admission_mode),
    year_admitted = COALESCE($8, year_admitted),
    updated_at = NOW()
WHERE id = $1
RETURNING *;
