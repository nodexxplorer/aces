-- name: CreateAssignment :one
INSERT INTO assignments (
    course_id, title, description, deadline, max_score, allowed_formats, file_url, uploaded_by_class_rep_id, created_by, session_id, semester_id, is_active
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
) RETURNING *;

-- name: GetAssignment :one
SELECT * FROM assignments
WHERE id = $1 LIMIT 1;

-- name: ListCourseAssignments :many
SELECT * FROM assignments
WHERE course_id = $1 AND session_id = $2
ORDER BY created_at DESC;

-- name: UpdateAssignment :one
UPDATE assignments
SET
    title = $2,
    description = $3,
    deadline = $4,
    max_score = $5,
    allowed_formats = $6,
    file_url = $7,
    is_active = $8
WHERE id = $1
RETURNING *;

-- name: DeleteAssignment :exec
DELETE FROM assignments
WHERE id = $1;


-- name: CreateAssignmentGrade :one
INSERT INTO assignment_grades (
    assignment_id, student_id, score, feedback, is_late, graded_by
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetAssignmentGrade :one
SELECT * FROM assignment_grades
WHERE assignment_id = $1 AND student_id = $2 LIMIT 1;

-- name: ListAssignmentGrades :many
SELECT * FROM assignment_grades
WHERE assignment_id = $1
ORDER BY graded_at DESC;

-- name: ListStudentAssignmentGrades :many
SELECT * FROM assignment_grades
WHERE student_id = $1
ORDER BY graded_at DESC;

-- name: UpdateAssignmentGrade :one
UPDATE assignment_grades
SET
    score = $2,
    feedback = $3,
    is_late = $4,
    graded_by = $5,
    graded_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteAssignmentGrade :exec
DELETE FROM assignment_grades
WHERE id = $1;
