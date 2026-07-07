-- name: CreateResult :one
INSERT INTO results (
    student_id, course_id, session_id, semester_id, ca_score, exam_score, total_score, grade, grade_point, status, is_carryover
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING *;

-- name: GetResult :one
SELECT * FROM results
WHERE id = $1 LIMIT 1;

-- name: ListStudentResults :many
SELECT * FROM results
WHERE student_id = $1
ORDER BY created_at DESC;

-- name: ListCourseResults :many
SELECT * FROM results
WHERE course_id = $1 AND session_id = $2
ORDER BY student_id;

-- name: UpdateResult :one
UPDATE results
SET
    ca_score = $2,
    exam_score = $3,
    total_score = $4,
    grade = $5,
    grade_point = $6,
    status = $7,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateResultStatus :one
UPDATE results
SET
    status = $2,
    approved_by = $3,
    approved_at = $4,
    rejection_reason = $5,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CreateResultAuditLog :one
INSERT INTO result_audit_logs (
    result_id, field_changed, old_value, new_value, reason, edited_by, ip_address, user_agent
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: ListResultAuditLogs :many
SELECT * FROM result_audit_logs
WHERE result_id = $1
ORDER BY created_at DESC;

-- name: CreateCarryoverCourse :one
INSERT INTO carryover_courses (
    student_id, course_id, original_result_id, original_session_id, attempt_count, max_attempts
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetCarryoverCourse :one
SELECT * FROM carryover_courses
WHERE id = $1 LIMIT 1;

-- name: UpdateCarryoverCourse :one
UPDATE carryover_courses
SET
    attempt_count = $2,
    is_resolved = $3,
    resolved_result_id = $4
WHERE id = $1
RETURNING *;

-- name: ListStudentCarryoverCourses :many
SELECT * FROM carryover_courses
WHERE student_id = $1
ORDER BY created_at DESC;

-- name: DeleteCarryoverCourse :exec
DELETE FROM carryover_courses
WHERE id = $1;
