-- name: CreateCourse :one
INSERT INTO courses (
    code, title, description, unit, level, semester, lecturer_id, prerequisite_id, max_credit_hours, is_active
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING *;

-- name: GetCourse :one
SELECT * FROM courses
WHERE id = $1 LIMIT 1;

-- name: GetCourseByCode :one
SELECT * FROM courses
WHERE code = $1 LIMIT 1;

-- name: ListCourses :many
SELECT * FROM courses
ORDER BY level, code
LIMIT $1 OFFSET $2;

-- name: UpdateCourse :one
UPDATE courses
SET
    title = $2,
    description = $3,
    unit = $4,
    level = $5,
    semester = $6,
    lecturer_id = $7,
    is_active = $8,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteCourse :exec
DELETE FROM courses
WHERE id = $1;
