-- name: GetStudentApprovedResultsWithUnits :many
SELECT r.grade_point, c.unit, r.session_id, r.semester_id
FROM results r
JOIN courses c ON r.course_id = c.id
WHERE r.student_id = $1 AND r.status = 'approved';

-- name: GetCgpaRules :many
SELECT * FROM cgpa_rules
WHERE is_active = true
ORDER BY min_score DESC;

-- name: CreateCgpaRule :one
INSERT INTO cgpa_rules (
    min_score, max_score, grade, grade_point, is_active
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetAcademicStandingRules :many
SELECT * FROM academic_standing_rules
WHERE is_active = true
ORDER BY min_cgpa DESC;

-- name: CreateAcademicStandingRule :one
INSERT INTO academic_standing_rules (
    min_cgpa, max_cgpa, standing, is_active
) VALUES (
    $1, $2, $3, $4
) RETURNING *;
