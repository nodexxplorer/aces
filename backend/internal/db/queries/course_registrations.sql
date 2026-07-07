-- name: CreateCourseRegistration :one
INSERT INTO course_registrations (
    student_id, session_id, semester_id, total_units, status
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetCourseRegistration :one
SELECT * FROM course_registrations
WHERE id = $1 LIMIT 1;

-- name: ListStudentCourseRegistrations :many
SELECT * FROM course_registrations
WHERE student_id = $1
ORDER BY created_at DESC;

-- name: UpdateCourseRegistration :one
UPDATE course_registrations
SET
    total_units = $2,
    status = $3,
    approved_by = $4,
    approved_at = $5
WHERE id = $1
RETURNING *;

-- name: CreateRegisteredCourse :one
INSERT INTO registered_courses (
    registration_id, course_id, status, is_carryover, previous_attempt_id
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetRegisteredCourse :one
SELECT * FROM registered_courses
WHERE id = $1 LIMIT 1;

-- name: ListRegisteredCoursesByRegistration :many
SELECT * FROM registered_courses
WHERE registration_id = $1
ORDER BY created_at ASC;

-- name: DeleteRegisteredCourse :exec
DELETE FROM registered_courses
WHERE id = $1;

-- name: UpdateRegisteredCourse :one
UPDATE registered_courses
SET
    status = $2,
    is_carryover = $3,
    previous_attempt_id = $4
WHERE id = $1
RETURNING *;
