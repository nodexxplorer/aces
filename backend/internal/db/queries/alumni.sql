-- ==================== ALUMNI STATUS ====================

-- name: CreateAlumniStatus :one
INSERT INTO alumni_status (
    user_id, graduation_year, graduation_class, is_mentor_available, mentor_specialization, current_company, current_position, linkedin_url, bio
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;

-- name: GetAlumniStatus :one
SELECT * FROM alumni_status WHERE user_id = $1 LIMIT 1;

-- name: ListAlumni :many
SELECT als.*, u.full_name, u.email, u.avatar_url
FROM alumni_status als JOIN users u ON als.user_id = u.id
WHERE als.verification_status = 'verified'
ORDER BY als.graduation_year DESC
LIMIT $1 OFFSET $2;

-- name: UpdateAlumniStatus :one
UPDATE alumni_status
SET is_mentor_available = $2, mentor_specialization = $3, current_company = $4, current_position = $5, linkedin_url = $6, bio = $7, updated_at = NOW()
WHERE user_id = $1 RETURNING *;

-- name: VerifyAlumni :one
UPDATE alumni_status SET verification_status = $2, verified_by = $3, verified_at = NOW(), updated_at = NOW()
WHERE user_id = $1 RETURNING *;

-- name: ListPendingAlumniVerifications :many
SELECT als.*, u.full_name, u.email
FROM alumni_status als JOIN users u ON als.user_id = u.id
WHERE als.verification_status = 'pending'
ORDER BY als.created_at;

-- ==================== MENTORSHIP REQUESTS ====================

-- name: CreateMentorshipRequest :one
INSERT INTO mentorship_requests (student_id, mentor_id, topic, message)
VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetMentorshipRequest :one
SELECT * FROM mentorship_requests WHERE id = $1 LIMIT 1;

-- name: ListStudentMentorshipRequests :many
SELECT mr.*, u.full_name AS mentor_name
FROM mentorship_requests mr JOIN users u ON mr.mentor_id = u.id
WHERE mr.student_id = $1 ORDER BY mr.created_at DESC;

-- name: ListMentorMentorshipRequests :many
SELECT mr.*, u.full_name AS student_name
FROM mentorship_requests mr JOIN users u ON mr.student_id = u.id
WHERE mr.mentor_id = $1 ORDER BY mr.created_at DESC;

-- name: UpdateMentorshipStatus :one
UPDATE mentorship_requests SET status = $2,
    responded_at = CASE WHEN $2 IN ('accepted','declined') THEN NOW() ELSE responded_at END,
    started_at = CASE WHEN $2 = 'active' THEN NOW() ELSE started_at END,
    ended_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE ended_at END
WHERE id = $1 RETURNING *;

-- ==================== JOB POSTS ====================

-- name: CreateJobPost :one
INSERT INTO job_posts (posted_by, title, company, location, job_type, description, requirements, salary_range, application_url, application_deadline)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- name: GetJobPost :one
SELECT jp.*, u.full_name AS poster_name
FROM job_posts jp JOIN users u ON jp.posted_by = u.id
WHERE jp.id = $1 LIMIT 1;

-- name: ListJobPosts :many
SELECT jp.*, u.full_name AS poster_name
FROM job_posts jp JOIN users u ON jp.posted_by = u.id
WHERE jp.is_active = true
ORDER BY jp.created_at DESC LIMIT $1 OFFSET $2;

-- name: ListUserJobPosts :many
SELECT * FROM job_posts WHERE posted_by = $1 ORDER BY created_at DESC;

-- name: UpdateJobPost :one
UPDATE job_posts SET title = $2, company = $3, location = $4, job_type = $5, description = $6, requirements = $7, salary_range = $8, application_url = $9, application_deadline = $10, is_active = $11, updated_at = NOW()
WHERE id = $1 RETURNING *;

-- name: DeleteJobPost :exec
UPDATE job_posts SET is_active = false, updated_at = NOW() WHERE id = $1;

-- ==================== JOB APPLICATIONS ====================

-- name: CreateJobApplication :one
INSERT INTO job_applications (job_id, applicant_id, cover_letter, resume_url)
VALUES ($1, $2, $3, $4) RETURNING *;

-- name: ListJobApplications :many
SELECT ja.*, u.full_name AS applicant_name, u.email AS applicant_email
FROM job_applications ja JOIN users u ON ja.applicant_id = u.id
WHERE ja.job_id = $1 ORDER BY ja.created_at DESC;

-- name: UpdateJobApplicationStatus :one
UPDATE job_applications SET status = $2, reviewed_by = $3, reviewed_at = NOW()
WHERE id = $1 RETURNING *;

-- name: ListStudentJobApplications :many
SELECT ja.*, u.full_name AS applicant_name, jp.title AS job_title, jp.company AS job_company
FROM job_applications ja
JOIN users u ON ja.applicant_id = u.id
JOIN job_posts jp ON ja.job_id = jp.id
WHERE ja.applicant_id = $1
ORDER BY ja.created_at DESC;

-- name: GetJobApplication :one
SELECT ja.*, u.full_name AS applicant_name
FROM job_applications ja JOIN users u ON ja.applicant_id = u.id
WHERE ja.id = $1 LIMIT 1;

-- ==================== ALUMNI EVENTS ====================

-- name: CreateAlumniEvent :one
INSERT INTO alumni_events (title, description, event_type, location, is_virtual, virtual_link, start_date, end_date, max_attendees, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- name: GetAlumniEvent :one
SELECT ae.*, COUNT(ea.id) AS attendee_count
FROM alumni_events ae LEFT JOIN event_attendees ea ON ae.id = ea.event_id
WHERE ae.id = $1 GROUP BY ae.id;

-- name: ListAlumniEvents :many
SELECT ae.*, COUNT(ea.id) AS attendee_count
FROM alumni_events ae LEFT JOIN event_attendees ea ON ae.id = ea.event_id
WHERE ae.is_active = true AND ae.start_date >= NOW()
GROUP BY ae.id ORDER BY ae.start_date LIMIT $1 OFFSET $2;

-- name: UpdateAlumniEvent :one
UPDATE alumni_events SET title = $2, description = $3, event_type = $4, location = $5, is_virtual = $6, virtual_link = $7, start_date = $8, end_date = $9, max_attendees = $10, is_active = $11
WHERE id = $1 RETURNING *;

-- ==================== EVENT ATTENDEES ====================

-- name: RegisterForEvent :one
INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2) RETURNING *;

-- name: ListEventAttendees :many
SELECT ea.*, u.full_name, u.email, u.avatar_url
FROM event_attendees ea JOIN users u ON ea.user_id = u.id
WHERE ea.event_id = $1 ORDER BY ea.registered_at;

-- name: UpdateRSVPStatus :one
UPDATE event_attendees SET rsvp_status = $3 WHERE event_id = $1 AND user_id = $2 RETURNING *;

-- name: CancelEventRegistration :exec
DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2;

-- ==================== MENTORSHIP SESSIONS ====================

-- name: CreateMentorshipSession :one
INSERT INTO mentorship_sessions (mentorship_id, scheduled_at, format)
VALUES ($1, $2, $3) RETURNING *;

-- name: ListMentorshipSessions :many
SELECT ms.* FROM mentorship_sessions ms
WHERE ms.mentorship_id = $1 ORDER BY ms.scheduled_at DESC;

-- name: UpdateMentorshipSessionStatus :one
UPDATE mentorship_sessions SET status = $2,
    mentor_confirmed = CASE WHEN $2 = 'completed' THEN true ELSE mentor_confirmed END,
    mentee_confirmed = CASE WHEN $2 = 'completed' THEN true ELSE mentee_confirmed END
WHERE id = $1 RETURNING *;

-- ==================== DONATIONS ====================

-- name: CreateDonation :one
INSERT INTO alumni_donations (donor_id, channel, amount, currency, message, is_anonymous, recognized_tier, status, paystack_reference)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8) RETURNING *;

-- name: GetDonationByReference :one
SELECT * FROM alumni_donations WHERE paystack_reference = $1 LIMIT 1;

-- name: UpdateDonationPaystackRef :exec
UPDATE alumni_donations SET paystack_reference = $1, updated_at = NOW() WHERE id = $2;

-- name: ListDonorDonations :many
SELECT * FROM alumni_donations WHERE donor_id = $1 ORDER BY created_at DESC;

-- name: ListAllDonations :many
SELECT ad.*, u.full_name AS donor_name
FROM alumni_donations ad JOIN users u ON ad.donor_id = u.id
ORDER BY ad.created_at DESC LIMIT $1 OFFSET $2;

-- name: GetDonationStats :one
SELECT
    COALESCE(SUM(amount), 0)::NUMERIC AS total_donations,
    COUNT(*)::INTEGER AS donation_count,
    COALESCE(SUM(CASE WHEN recognized_tier = 'platinum' THEN 1 ELSE 0 END), 0)::INTEGER AS platinum_count,
    COALESCE(SUM(CASE WHEN recognized_tier = 'gold' THEN 1 ELSE 0 END), 0)::INTEGER AS gold_count,
    COALESCE(SUM(CASE WHEN recognized_tier = 'silver' THEN 1 ELSE 0 END), 0)::INTEGER AS silver_count,
    COALESCE(SUM(CASE WHEN recognized_tier = 'bronze' THEN 1 ELSE 0 END), 0)::INTEGER AS bronze_count
FROM alumni_donations WHERE status = 'completed';

-- ==================== ALUMNI AUDIT LOGS ====================

-- name: CreateAuditLog :exec
INSERT INTO alumni_audit_logs (alumni_id, action, actor_id, details, ip_address)
VALUES ($1, $2, $3, $4, $5);

-- name: ListAlumniAuditLogs :many
SELECT * FROM alumni_audit_logs WHERE alumni_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- ==================== ENHANCED QUERIES ====================

-- name: SearchAlumniDirectory :many
SELECT als.*, u.full_name, u.email, u.avatar_url
FROM alumni_status als JOIN users u ON als.user_id = u.id
WHERE als.verification_status = 'verified'
    AND ($1::TEXT IS NULL OR u.full_name ILIKE '%' || $1 || '%' OR als.current_company ILIKE '%' || $1 || '%')
    AND ($2::INTEGER IS NULL OR als.graduation_year >= $2)
    AND ($3::INTEGER IS NULL OR als.graduation_year <= $3)
    AND ($4::TEXT IS NULL OR als.industry = $4)
    AND ($5::TEXT IS NULL OR als.location ILIKE '%' || $5 || '%')
    AND ($6::BOOLEAN IS NULL OR als.is_mentor_available = $6)
ORDER BY u.full_name
LIMIT $7 OFFSET $8;

-- name: GetAlumniDashboardStats :one
SELECT
    (SELECT COUNT(*)::INTEGER FROM alumni_status WHERE verification_status = 'verified') AS total_alumni,
    (SELECT COUNT(*)::INTEGER FROM alumni_status WHERE verification_status = 'verified' AND updated_at >= NOW() - INTERVAL '1 year') AS active_this_year,
    (SELECT COUNT(*)::INTEGER FROM alumni_status WHERE verification_status = 'verified' AND created_at >= NOW() - INTERVAL '1 year') AS new_this_session,
    (SELECT COUNT(*)::INTEGER FROM job_posts WHERE is_active = true) AS active_jobs,
    (SELECT COUNT(*)::INTEGER FROM mentorship_requests WHERE status IN ('accepted', 'active')) AS active_mentorships,
    (SELECT COUNT(*)::INTEGER FROM alumni_events WHERE is_active = true AND start_date >= NOW()) AS upcoming_events;

-- name: GetAlumniMyStats :one
SELECT
    (SELECT COUNT(*)::INTEGER FROM connections WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted') AS connection_count,
    (SELECT COUNT(*)::INTEGER FROM mentorship_requests WHERE mentor_id = $1 AND status IN ('accepted', 'active')) AS active_mentees,
    (SELECT COUNT(*)::INTEGER FROM mentorship_sessions ms JOIN mentorship_requests mr ON ms.mentorship_id = mr.id WHERE mr.mentor_id = $1 AND ms.status = 'completed') AS completed_sessions,
    (SELECT COUNT(*)::INTEGER FROM job_posts WHERE posted_by = $1 AND is_active = true) AS jobs_posted,
    (SELECT COUNT(*)::INTEGER FROM event_attendees ea JOIN alumni_events ae ON ea.event_id = ae.id WHERE ea.user_id = $1) AS events_attended;

-- name: IncrementJobViews :exec
UPDATE job_posts SET views_count = views_count + 1 WHERE id = $1;

-- name: IncrementJobApplications :exec
UPDATE job_posts SET applications_count = applications_count + 1 WHERE id = $1;
