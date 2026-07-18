-- Class Rep Assignment Queries

-- name: CreateClassRepAssignment :one
INSERT INTO class_rep_assignments (
    class_rep_id, level, academic_year, appointment_type, appointed_by, consecutive_terms
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: GetActiveClassRepAssignment :one
SELECT * FROM class_rep_assignments
WHERE class_rep_id = $1 AND is_active = true
LIMIT 1;

-- name: ListActiveClassRepAssignments :many
SELECT * FROM class_rep_assignments
WHERE is_active = true
ORDER BY level, academic_year;

-- name: DeactivateClassRepByLevel :exec
UPDATE class_rep_assignments
SET is_active = false, end_date = NOW(), updated_at = NOW()
WHERE level = $1 AND academic_year = $2 AND is_active = true;

-- name: ListStudentsByLevel :many
SELECT * FROM students
WHERE level = $1
ORDER BY matric_number;

-- Election Queries

-- name: CreateClassRepElection :one
INSERT INTO class_rep_elections (
    level, academic_year, created_by, status, nomination_start, nomination_end, voting_start, voting_end
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: GetClassRepElection :one
SELECT * FROM class_rep_elections
WHERE id = $1 LIMIT 1;

-- name: ListClassRepElections :many
SELECT * FROM class_rep_elections
WHERE ($1::int IS NULL OR level = $1)
ORDER BY created_at DESC;

-- name: CompleteElection :one
UPDATE class_rep_elections
SET status = 'completed', winner_id = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: IncrementElectionVotes :exec
UPDATE class_rep_elections
SET total_votes = total_votes + 1, updated_at = NOW()
WHERE id = $1;

-- Nominee Queries

-- name: CreateElectionNominee :one
INSERT INTO election_nominees (
    election_id, student_id, manifesto, nominated_by, status
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: ListElectionNominees :many
SELECT en.*, u.full_name as student_name
FROM election_nominees en
JOIN users u ON u.id = en.student_id
WHERE en.election_id = $1
ORDER BY en.created_at;

-- name: GetElectionWinner :one
SELECT en.*, COUNT(ev.id)::int as vote_count
FROM election_nominees en
LEFT JOIN election_votes ev ON ev.nominee_id = en.id
WHERE en.election_id = $1
GROUP BY en.id
ORDER BY vote_count DESC
LIMIT 1;

-- Vote Queries

-- name: CastElectionVote :one
INSERT INTO election_votes (
    election_id, nominee_id, voter_id
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: GetElectionResults :many
SELECT en.*, COUNT(ev.id)::int as vote_count
FROM election_nominees en
LEFT JOIN election_votes ev ON ev.nominee_id = en.id
WHERE en.election_id = $1
GROUP BY en.id
ORDER BY vote_count DESC;

-- Report Queries

-- name: CreateClassRepReport :one
INSERT INTO class_rep_reports (
    class_rep_id, report_type, title, content, level, academic_year, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: ListClassRepReportsByRep :many
SELECT * FROM class_rep_reports
WHERE class_rep_id = $1
  AND ($2::text IS NULL OR status = $2)
ORDER BY created_at DESC;

-- name: ListAllClassRepReports :many
SELECT cr.*, u.full_name as class_rep_name
FROM class_rep_reports cr
JOIN users u ON u.id = cr.class_rep_id
WHERE ($1::text IS NULL OR cr.status = $1)
ORDER BY cr.created_at DESC;

-- name: UpdateClassRepReportStatus :one
UPDATE class_rep_reports
SET status = $2, reviewed_by = $3, review_notes = $4, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- Attendance Session Queries (enhanced)

-- name: CreateAttendanceSession :one
INSERT INTO attendance_sessions (
    course_id, class_rep_id, method, venue, status
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: UpdateAttendanceSessionStatus :one
UPDATE attendance_sessions
SET status = $2,
    started_at = CASE WHEN $2 = 'open' THEN NOW() ELSE started_at END,
    closed_at = CASE WHEN $2 = 'closed' OR $2 = 'finalized' THEN NOW() ELSE closed_at END
WHERE id = $1
RETURNING *;

-- name: UpdateAttendanceSessionCounts :exec
UPDATE attendance_sessions AS asess
SET
    total_present = (SELECT COUNT(*)::int FROM attendance_checkins WHERE session_id = asess.id AND present = true),
    total_absent = (SELECT COUNT(*)::int FROM attendance_checkins WHERE session_id = asess.id AND present = false),
    total_students = (SELECT COUNT(*)::int FROM attendance_checkins WHERE session_id = asess.id)
WHERE asess.id = $1;

-- name: ListAttendanceSessionCheckins :many
SELECT ac.*, u.full_name as student_name, s.matric_number
FROM attendance_checkins ac
JOIN users u ON u.id = ac.student_id
JOIN students s ON s.user_id = u.id
WHERE ac.session_id = $1
ORDER BY ac.checked_in_at;

-- name: CheckInStudent :one
INSERT INTO attendance_checkins (
    session_id, student_id, method, present, remark
) VALUES (
    $1, $2, $3, $4, $5
) ON CONFLICT (session_id, student_id) DO UPDATE
SET present = EXCLUDED.present, method = EXCLUDED.method, remark = EXCLUDED.remark, checked_in_at = NOW()
RETURNING *;

-- name: DeactivateClassRepByID :exec
UPDATE class_rep_assignments SET is_active = false WHERE id = $1;

-- name: UpdateElectionNomineeStatus :one
UPDATE election_nominees SET status = $1 WHERE id = $2
RETURNING id, election_id, student_id, manifesto, status, created_at;

-- name: ListAttendanceSessionsByRep :many
SELECT id, class_rep_id, course_id, date, method, venue, status, total_students, total_present, total_absent, created_at
FROM attendance_sessions
WHERE class_rep_id = $1
ORDER BY created_at DESC;

-- name: ListPendingCourseRegistrationsByLevel :many
SELECT cr.id, cr.student_id, s.level, cr.session_id, cr.status, cr.created_at,
       u.full_name as student_name, st.matric_number,
       COUNT(rc.id) as courses_count
FROM course_registrations cr
JOIN students st ON st.id = cr.student_id
JOIN users u ON u.id = st.user_id
JOIN students s ON s.id = cr.student_id
LEFT JOIN registered_courses rc ON rc.registration_id = cr.id
WHERE cr.status = 'pending' AND s.level = $1
GROUP BY cr.id, cr.student_id, s.level, cr.session_id, cr.status, cr.created_at, u.full_name, st.matric_number
ORDER BY cr.created_at DESC;

-- name: CreateClassRepPerformanceReview :one
INSERT INTO class_rep_performance (class_rep_id, reviewed_by, academic_year, term, attendance_rate, reports_submitted, responsiveness_score, comments, rating)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListClassRepPerformanceReviews :many
SELECT id, class_rep_id, reviewed_by, academic_year, term, attendance_rate, reports_submitted, responsiveness_score, comments, rating, created_at
FROM class_rep_performance
WHERE class_rep_id = $1
ORDER BY created_at DESC;
