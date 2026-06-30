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
