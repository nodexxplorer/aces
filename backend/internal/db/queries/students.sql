-- name: CreateStudent :one
INSERT INTO students (
    user_id, matric_number, level, entry_year, current_session_id, current_semester
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetStudent :one
SELECT * FROM students
WHERE id = $1 LIMIT 1;

-- name: GetStudentByMatric :one
SELECT * FROM students
WHERE matric_number = $1 LIMIT 1;

-- name: GetStudentByUserId :one
SELECT * FROM students
WHERE user_id = $1 LIMIT 1;

-- name: ListStudents :many
SELECT * FROM students
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: UpdateStudentAcademicRecord :one
UPDATE students
SET
    cgpa = $2,
    total_credits_earned = $3,
    academic_standing = $4,
    graduation_status = $5,
    updated_at = NOW()
WHERE id = $1
RETURNING *;
