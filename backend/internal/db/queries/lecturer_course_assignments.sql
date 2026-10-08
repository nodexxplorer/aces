
-- name: IsLecturerAssignedToCourse :one
-- Returns whether the lecturer is tied to the course via the
-- lecturer_course_assignments table (moved here from a hand-written method
-- so it stays part of the generated Querier interface).
SELECT EXISTS(
    SELECT 1 FROM lecturer_course_assignments
    WHERE lecturer_id = $1 AND course_id = $2
) AS assigned;
