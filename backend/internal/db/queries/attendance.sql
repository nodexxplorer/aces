-- name: CreateAttendanceSheet :one
INSERT INTO attendance_sheets (
    course_id, date, class_rep_id, attendance_data, session_id, status
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetAttendanceSheet :one
SELECT * FROM attendance_sheets
WHERE id = $1 LIMIT 1;

-- name: ListCourseAttendanceSheets :many
SELECT * FROM attendance_sheets
WHERE course_id = $1 AND session_id = $2
ORDER BY date DESC
LIMIT $3 OFFSET $4;

-- name: ListStudentAttendance :many
-- Returns attendance sheets for a session where the student appears in attendance_data
SELECT * FROM attendance_sheets
WHERE session_id = $1
  AND attendance_data @> jsonb_build_array(jsonb_build_object('student_id', $2::text))
ORDER BY date DESC;

-- name: UpdateAttendanceSheet :one
UPDATE attendance_sheets
SET
    attendance_data = $2,
    status = $3,
    pdf_url = $4,
    finalized_at = CASE WHEN $3 = 'finalized' THEN NOW() ELSE finalized_at END,
    emailed_to_lecturer = $5
WHERE id = $1
RETURNING *;

-- name: FinalizeAttendanceSheet :one
UPDATE attendance_sheets
SET
    status = 'finalized',
    finalized_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetAttendanceSummary :one
-- Returns total classes held and attended for a student in a course/session
SELECT
    COUNT(*)::int                                                             AS total_classes,
    COUNT(*) FILTER (
        WHERE attendance_data @> jsonb_build_array(
            jsonb_build_object('student_id', $3::text, 'present', true)
        )
    )::int                                                                    AS attended_classes
FROM attendance_sheets
WHERE course_id = $1
  AND session_id = $2
  AND status = 'finalized';

-- name: DeleteAttendanceSheet :exec
DELETE FROM attendance_sheets
WHERE id = $1;
