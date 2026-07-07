-- name: CreateTimetableEntry :one
INSERT INTO timetable (
    course_id,
    exam_date,
    start_time,
    end_time,
    venue,
    session_id,
    semester_id,
    has_conflict,
    conflict_details,
    created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING *;

-- name: GetTimetableEntry :one
SELECT * FROM timetable
WHERE id = $1 LIMIT 1;

-- name: ListTimetableEntries :many
SELECT * FROM timetable
WHERE session_id = $1 AND semester_id = $2
ORDER BY exam_date, start_time;

-- name: UpdateTimetableEntry :one
UPDATE timetable
SET 
    exam_date = $2,
    start_time = $3,
    end_time = $4,
    venue = $5,
    has_conflict = $6,
    conflict_details = $7
WHERE id = $1
RETURNING *;

-- name: DeleteTimetableEntry :exec
DELETE FROM timetable
WHERE id = $1;
