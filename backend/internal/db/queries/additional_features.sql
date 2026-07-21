-- name: CreatePasswordReset :one
INSERT INTO password_resets (user_id, channel, otp_code, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetPasswordResetByCode :one
SELECT * FROM password_resets
WHERE otp_code = $1 AND used = false AND expires_at > NOW()
LIMIT 1;

-- name: GetPasswordResetByUser :one
SELECT * FROM password_resets
WHERE user_id = $1 AND used = false AND expires_at > NOW()
ORDER BY created_at DESC LIMIT 1;

-- name: UsePasswordReset :exec
UPDATE password_resets SET used = true WHERE id = $1;

-- name: IncrementResetAttempts :exec
UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1;

-- name: CleanupExpiredResets :exec
DELETE FROM password_resets WHERE expires_at < NOW() - INTERVAL '1 hour';

-- name: CreateLockoutIfNeeded :exec
INSERT INTO account_lockouts (user_id)
VALUES ($1)
ON CONFLICT DO NOTHING;

-- name: GetLockoutStatusByUser :one
SELECT * FROM account_lockouts WHERE user_id = $1;

-- name: RecordFailedLogin :exec
UPDATE account_lockouts
SET failed_attempts = failed_attempts + 1,
    ip_addresses = CASE
        WHEN ip_addresses IS NULL THEN jsonb_build_array($2::text)
        WHEN ip_addresses @> to_jsonb($2::text) THEN ip_addresses
        ELSE ip_addresses || to_jsonb($2::text)
    END,
    updated_at = NOW()
WHERE user_id = $1;

-- name: LockAccount :exec
UPDATE account_lockouts
SET is_locked = true,
    locked_at = NOW(),
    unlock_at = NOW() + INTERVAL '30 minutes',
    updated_at = NOW()
WHERE user_id = $1;

-- name: GetLockoutStatus :one
SELECT * FROM account_lockouts WHERE user_id = $1;

-- name: ResetLockout :exec
UPDATE account_lockouts
SET failed_attempts = 0,
    is_locked = false,
    locked_at = NULL,
    unlock_at = NULL,
    updated_at = NOW()
WHERE user_id = $1;

-- name: CreateActiveSession :one
INSERT INTO active_sessions (user_id, session_token, device_info, ip_address, user_agent, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetActiveSessionByToken :one
SELECT * FROM active_sessions
WHERE session_token = $1 AND expires_at > NOW();

-- name: ListUserSessions :many
SELECT * FROM active_sessions
WHERE user_id = $1 AND expires_at > NOW()
ORDER BY last_active_at DESC;

-- name: UpdateSessionActivity :exec
UPDATE active_sessions SET last_active_at = NOW() WHERE session_token = $1;

-- name: DeleteActiveSession :exec
DELETE FROM active_sessions WHERE id = $1 AND user_id = $2;

-- name: DeleteUserSessions :exec
DELETE FROM active_sessions WHERE user_id = $1;

-- name: CleanupExpiredSessions :exec
DELETE FROM active_sessions WHERE expires_at < NOW();

-- name: CreateGradeAppeal :one
INSERT INTO grade_appeals (student_id, course_id, semester_id, session_id, reason, evidence_urls)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListStudentAppeals :many
SELECT ga.*, c.code AS course_code, c.title AS course_title
FROM grade_appeals ga
JOIN courses c ON c.id = ga.course_id
WHERE ga.student_id = $1
ORDER BY ga.created_at DESC;

-- name: ListPendingAppeals :many
SELECT ga.*, c.code AS course_code, c.title AS course_title,
       u.full_name AS student_name
FROM grade_appeals ga
JOIN courses c ON c.id = ga.course_id
JOIN users u ON u.id = ga.student_id
WHERE ga.status = $1
ORDER BY ga.created_at DESC;

-- name: GetGradeAppeal :one
SELECT ga.*, c.code AS course_code, c.title AS course_title,
       u.full_name AS student_name
FROM grade_appeals ga
JOIN courses c ON c.id = ga.course_id
JOIN users u ON u.id = ga.student_id
WHERE ga.id = $1;

-- name: UpdateGradeAppealStatus :exec
UPDATE grade_appeals
SET status = $2,
    lecturer_response = $3,
    lecturer_id = $4,
    hod_response = $5,
    hod_id = $6,
    revised_score = $7,
    resolved_at = CASE WHEN $2 IN ('resolved', 'rejected') THEN NOW() ELSE resolved_at END,
    updated_at = NOW()
WHERE id = $1;

-- name: CreateStudyTask :one
INSERT INTO study_tasks (user_id, course_id, title, description, priority, due_date, reminder_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListUserStudyTasks :many
SELECT st.*, c.code AS course_code, c.title AS course_title
FROM study_tasks st
LEFT JOIN courses c ON c.id = st.course_id
WHERE st.user_id = $1 AND st.status != 'cancelled'
ORDER BY
    CASE st.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
    COALESCE(st.due_date, NOW() + INTERVAL '30 days');

-- name: GetStudyTask :one
SELECT st.*, c.code AS course_code, c.title AS course_title
FROM study_tasks st
LEFT JOIN courses c ON c.id = st.course_id
WHERE st.id = $1 AND st.user_id = $2;

-- name: UpdateStudyTask :exec
UPDATE study_tasks
SET title = $3, description = $4, priority = $5, status = $6,
    due_date = $7, reminder_at = $8,
    completed_at = CASE WHEN $6 = 'completed' THEN NOW() ELSE completed_at END,
    updated_at = NOW()
WHERE id = $1 AND user_id = $2;

-- name: DeleteStudyTask :exec
UPDATE study_tasks SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND user_id = $2;

-- name: GetUpcomingTasks :many
SELECT st.*, c.code AS course_code
FROM study_tasks st
LEFT JOIN courses c ON c.id = st.course_id
WHERE st.user_id = $1 AND st.status IN ('pending', 'in_progress')
  AND st.due_date IS NOT NULL AND st.due_date <= $2
ORDER BY st.due_date;

-- name: CreateClassNotice :one
INSERT INTO class_notices (class_rep_id, title, content, is_pinned, allow_comments, attachment_url, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListClassNotices :many
SELECT cn.*, u.full_name AS author_name
FROM class_notices cn
JOIN users u ON u.id = cn.class_rep_id
WHERE (cn.expires_at IS NULL OR cn.expires_at > NOW())
ORDER BY cn.is_pinned DESC, cn.pinned_order NULLS LAST, cn.created_at DESC;

-- name: GetClassNotice :one
SELECT cn.*, u.full_name AS author_name
FROM class_notices cn
JOIN users u ON u.id = cn.class_rep_id
WHERE cn.id = $1;

-- name: UpdateClassNotice :exec
UPDATE class_notices
SET title = $2, content = $3, is_pinned = $4, pinned_order = $5,
    allow_comments = $6, attachment_url = $7, expires_at = $8, updated_at = NOW()
WHERE id = $1 AND class_rep_id = $9;

-- name: PinClassNotice :exec
UPDATE class_notices SET is_pinned = true, pinned_order = $2, updated_at = NOW() WHERE id = $1;

-- name: UnpinClassNotice :exec
UPDATE class_notices SET is_pinned = false, pinned_order = NULL, updated_at = NOW() WHERE id = $1;

-- name: DeleteClassNotice :exec
DELETE FROM class_notices WHERE id = $1 AND class_rep_id = $2;

-- name: CreateNoticeComment :one
INSERT INTO class_notice_comments (notice_id, user_id, content)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListNoticeComments :many
SELECT cnc.*, u.full_name AS author_name
FROM class_notice_comments cnc
JOIN users u ON u.id = cnc.user_id
WHERE cnc.notice_id = $1
ORDER BY cnc.created_at;

-- name: CreateStaffMeeting :one
INSERT INTO staff_meetings (organizer_id, title, description, meeting_date, duration_minutes, venue, is_recurring, recurrence_pattern)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListUpcomingMeetings :many
SELECT sm.*, u.full_name AS organizer_name
FROM staff_meetings sm
JOIN users u ON u.id = sm.organizer_id
WHERE sm.meeting_date >= $1 AND sm.status != 'cancelled'
ORDER BY sm.meeting_date;

-- name: GetStaffMeeting :one
SELECT sm.*, u.full_name AS organizer_name
FROM staff_meetings sm
JOIN users u ON u.id = sm.organizer_id
WHERE sm.id = $1;

-- name: UpdateMeetingStatus :exec
UPDATE staff_meetings SET status = $2, minutes_url = $3 WHERE id = $1;

-- name: AddMeetingAttendee :exec
INSERT INTO meeting_attendees (meeting_id, user_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: RespondToMeeting :exec
UPDATE meeting_attendees
SET responded = true, attending = $3, responded_at = NOW()
WHERE meeting_id = $1 AND user_id = $2;

-- name: ListMeetingAttendees :many
SELECT ma.*, u.full_name AS attendee_name, u.email AS attendee_email
FROM meeting_attendees ma
JOIN users u ON u.id = ma.user_id
WHERE ma.meeting_id = $1;

-- name: CreateBroadcast :one
INSERT INTO emergency_broadcasts (sender_id, title, message, priority, template, channels, target_roles, requires_acknowledgment)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListRecentBroadcasts :many
SELECT eb.*, u.full_name AS sender_name
FROM emergency_broadcasts eb
JOIN users u ON u.id = eb.sender_id
ORDER BY eb.created_at DESC
LIMIT $1;

-- name: GetBroadcast :one
SELECT eb.*, u.full_name AS sender_name
FROM emergency_broadcasts eb
JOIN users u ON u.id = eb.sender_id
WHERE eb.id = $1;

-- name: AcknowledgeBroadcast :exec
INSERT INTO broadcast_acknowledgments (broadcast_id, user_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: GetBroadcastAckCount :one
SELECT COUNT(*)::int AS ack_count FROM broadcast_acknowledgments WHERE broadcast_id = $1;

-- name: HasUserAcknowledged :one
SELECT COUNT(*)::int > 0 AS acknowledged FROM broadcast_acknowledgments
WHERE broadcast_id = $1 AND user_id = $2;

-- name: ListUserBroadcasts :many
SELECT eb.*, u.full_name AS sender_name,
       EXISTS(
           SELECT 1 FROM broadcast_acknowledgments ba
           WHERE ba.broadcast_id = eb.id AND ba.user_id = $1
       ) AS acknowledged
FROM emergency_broadcasts eb
JOIN users u ON u.id = eb.sender_id
WHERE eb.target_roles @> to_jsonb($2::text)
ORDER BY eb.created_at DESC
LIMIT $3;

-- name: CreateDepartmentalEvent :one
INSERT INTO departmental_events (creator_id, title, description, event_type, start_time, end_time, venue, target_levels, target_audience, is_all_day, color)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: ListDepartmentalEvents :many
SELECT de.*, u.full_name AS creator_name
FROM departmental_events de
JOIN users u ON u.id = de.creator_id
WHERE de.start_time >= $1 AND (de.end_time IS NULL OR de.end_time <= $2)
ORDER BY de.start_time;

-- name: GetDepartmentalEvent :one
SELECT de.*, u.full_name AS creator_name
FROM departmental_events de
JOIN users u ON u.id = de.creator_id
WHERE de.id = $1;

-- name: UpdateDepartmentalEvent :exec
UPDATE departmental_events
SET title = $2, description = $3, event_type = $4, start_time = $5,
    end_time = $6, venue = $7, target_levels = $8, target_audience = $9,
    is_all_day = $10, color = $11
WHERE id = $1;

-- name: DeleteDepartmentalEvent :exec
DELETE FROM departmental_events WHERE id = $1;

-- name: CreateExpense :one
INSERT INTO expenses (description, amount, category, expense_date, receipt_url, submitted_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListExpenses :many
SELECT e.*, u.full_name AS submitted_by_name
FROM expenses e
JOIN users u ON u.id = e.submitted_by
WHERE ($1 = '' OR e.status = $1)
ORDER BY e.expense_date DESC;

-- name: GetExpense :one
SELECT e.*, u.full_name AS submitted_by_name
FROM expenses e
JOIN users u ON u.id = e.submitted_by
WHERE e.id = $1;

-- name: UpdateExpenseStatus :exec
UPDATE expenses
SET status = $2, approved_by = $3, approved_at = CASE WHEN $2 IN ('approved', 'rejected') THEN NOW() ELSE approved_at END,
    rejection_reason = $4, updated_at = NOW()
WHERE id = $1;

-- name: GetExpenseSummary :one
SELECT
    COALESCE(SUM(amount), 0)::numeric AS total_expenses,
    COUNT(*)::int AS total_count,
    COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
    COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count,
    COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::numeric AS approved_amount
FROM expenses;

-- name: GetExpenseByCategory :many
SELECT category,
    COALESCE(SUM(amount), 0)::numeric AS total_amount,
    COUNT(*)::int AS expense_count
FROM expenses
WHERE status = 'approved'
GROUP BY category
ORDER BY total_amount DESC;

-- name: CreateExpenseBudget :one
INSERT INTO expense_budgets (category, session_id, budget_amount, alert_threshold)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetExpenseBudget :one
SELECT * FROM expense_budgets WHERE category = $1 AND ($2::uuid IS NULL OR session_id = $2);

-- name: UpdateBudgetSpent :exec
UPDATE expense_budgets
SET spent_amount = spent_amount + $2, updated_at = NOW()
WHERE category = $1;

-- name: GetBudgetAlerts :many
SELECT * FROM expense_budgets
WHERE spent_amount >= budget_amount * alert_threshold;

-- name: CreateFeatureFlag :one
INSERT INTO feature_flags (name, description, is_enabled, target_roles, target_levels, percentage, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListFeatureFlags :many
SELECT * FROM feature_flags ORDER BY name;

-- name: GetFeatureFlag :one
SELECT * FROM feature_flags WHERE name = $1;

-- name: IsFeatureEnabledForUser :one
SELECT is_enabled FROM feature_flags
WHERE name = $1
  AND (target_roles = '[]'::jsonb OR target_roles @> to_jsonb($2::text))
  AND (target_levels = '[]'::jsonb OR target_levels @> to_jsonb($3::text));

-- name: ToggleFeatureFlag :exec
UPDATE feature_flags SET is_enabled = $2, updated_at = NOW() WHERE name = $1;

-- name: UpdateFeatureFlag :exec
UPDATE feature_flags
SET description = $2, is_enabled = $3, target_roles = $4,
    target_levels = $5, percentage = $6, updated_at = NOW()
WHERE name = $1;

-- name: DeleteFeatureFlag :exec
DELETE FROM feature_flags WHERE name = $1;

-- name: CreateFeedback :one
INSERT INTO feedback_submissions (user_id, feedback_type, title, description, rating, screenshot_url, device_info)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListFeedback :many
SELECT fs.*, u.full_name AS user_name
FROM feedback_submissions fs
JOIN users u ON u.id = fs.user_id
WHERE ($1 = '' OR fs.status = $1)
ORDER BY fs.created_at DESC;

-- name: GetFeedback :one
SELECT fs.*, u.full_name AS user_name
FROM feedback_submissions fs
JOIN users u ON u.id = fs.user_id
WHERE fs.id = $1;

-- name: UpdateFeedbackStatus :exec
UPDATE feedback_submissions
SET status = $2, admin_response = $3, responded_at = NOW()
WHERE id = $1;

-- name: ListUserFeedback :many
SELECT * FROM feedback_submissions
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: CreateHelpArticle :one
INSERT INTO help_articles (category, title, content, sort_order, is_published)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListHelpArticles :many
SELECT * FROM help_articles
WHERE is_published = true
ORDER BY category, sort_order, title;

-- name: ListHelpArticlesByCategory :many
SELECT * FROM help_articles
WHERE category = $1 AND is_published = true
ORDER BY sort_order, title;

-- name: GetHelpArticle :one
SELECT * FROM help_articles WHERE id = $1;

-- name: UpdateHelpArticle :exec
UPDATE help_articles
SET category = $2, title = $3, content = $4, sort_order = $5, is_published = $6, updated_at = NOW()
WHERE id = $1;

-- name: DeleteHelpArticle :exec
DELETE FROM help_articles WHERE id = $1;

-- name: IncrementHelpArticleViews :exec
UPDATE help_articles SET view_count = view_count + 1 WHERE id = $1;

-- name: MarkHelpArticleHelpful :exec
UPDATE help_articles SET helpful_count = helpful_count + 1 WHERE id = $1;

-- name: SearchHelpArticles :many
SELECT * FROM help_articles
WHERE is_published = true AND (title ILIKE $1 OR content ILIKE $1)
ORDER BY view_count DESC
LIMIT $2;

-- name: CreateGPAScenario :one
INSERT INTO gpa_scenarios (user_id, name, courses)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListGPAScenarios :many
SELECT * FROM gpa_scenarios WHERE user_id = $1 ORDER BY updated_at DESC;

-- name: GetGPAScenario :one
SELECT * FROM gpa_scenarios WHERE id = $1 AND user_id = $2;

-- name: UpdateGPAScenario :exec
UPDATE gpa_scenarios SET name = $3, courses = $4, updated_at = NOW()
WHERE id = $1 AND user_id = $2;

-- name: DeleteGPAScenario :exec
DELETE FROM gpa_scenarios WHERE id = $1 AND user_id = $2;

-- name: UniversalSearch :many
SELECT 'course' AS result_type, id::text AS id, code AS title, '' AS subtitle, 0 AS relevance
FROM courses WHERE code ILIKE $1 OR title ILIKE $1
UNION ALL
SELECT 'student' AS result_type, u.id::text, u.full_name, s.matric_number, 0
FROM users u JOIN students s ON s.user_id = u.id
WHERE u.full_name ILIKE $1 OR s.matric_number ILIKE $1
UNION ALL
SELECT 'announcement' AS result_type, id::text, title, content, 0
FROM announcements WHERE title ILIKE $1 OR content ILIKE $1
ORDER BY relevance DESC
LIMIT $2;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2;
