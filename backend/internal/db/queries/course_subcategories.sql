-- ==================== COURSE SUBCATEGORIES ====================

-- name: CreateCourseSubcategory :one
INSERT INTO course_subcategories (
    course_id, name, weight_percentage
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: GetCourseSubcategory :one
SELECT * FROM course_subcategories
WHERE id = $1 LIMIT 1;

-- name: ListCourseSubcategories :many
SELECT * FROM course_subcategories
WHERE course_id = $1 AND is_active = true
ORDER BY name;

-- name: UpdateCourseSubcategory :one
UPDATE course_subcategories
SET name = $2, weight_percentage = $3, is_active = $4
WHERE id = $1
RETURNING *;

-- name: DeleteCourseSubcategory :exec
UPDATE course_subcategories SET is_active = false WHERE id = $1;
