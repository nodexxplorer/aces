-- ==================== VERIFICATION RECORDS ====================

-- name: CreateVerificationRecord :one
INSERT INTO verification_records (matric_number, full_name, level, entry_session, department, status)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetVerificationRecordByMatric :one
SELECT * FROM verification_records WHERE matric_number = $1;

-- name: ListVerificationRecords :many
SELECT * FROM verification_records
WHERE ($1::text IS NULL OR matric_number ILIKE '%' || $1 || '%'
       OR full_name ILIKE '%' || $1 || '%')
AND ($2::int IS NULL OR level = $2)
AND ($3::text IS NULL OR status = $3)
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;

-- name: UpdateVerificationRecord :exec
UPDATE verification_records
SET full_name = COALESCE($2, full_name), level = COALESCE($3, level),
    entry_session = COALESCE($4, entry_session), status = COALESCE($5, status),
    updated_at = NOW()
WHERE id = $1;

-- name: BulkCreateVerificationRecords :exec
INSERT INTO verification_records (matric_number, full_name, level, entry_session, department, status)
SELECT unnest($1::text[]), unnest($2::text[]), unnest($3::int[]),
       unnest($4::text[]), unnest($5::text[]), unnest($6::text[])
ON CONFLICT (matric_number) DO UPDATE
SET full_name = EXCLUDED.full_name, level = EXCLUDED.level,
    entry_session = EXCLUDED.entry_session, status = EXCLUDED.status,
    updated_at = NOW();

-- name: GetUnverifiedStudents :many
SELECT vr.*
FROM verification_records vr
WHERE NOT EXISTS (
    SELECT 1 FROM student_onboardings so
    WHERE so.verification_record_id = vr.id AND so.status = 'approved'
)
AND vr.status = 'active'
ORDER BY vr.created_at DESC;

-- ==================== STUDENT ONBOARDINGS ====================

-- name: CreateStudentOnboarding :one
INSERT INTO student_onboardings (user_id, matric_number, verification_record_id, match_confidence, submitted_email, submitted_phone, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetStudentOnboardingByUserID :one
SELECT so.*, vr.full_name AS verified_name, vr.level AS verified_level, vr.department AS verified_department
FROM student_onboardings so
LEFT JOIN verification_records vr ON vr.id = so.verification_record_id
WHERE so.user_id = $1;

-- name: GetStudentOnboardingByMatric :one
SELECT so.*, vr.full_name AS verified_name, vr.level AS verified_level
FROM student_onboardings so
LEFT JOIN verification_records vr ON vr.id = so.verification_record_id
WHERE so.matric_number = $1;

-- name: ListStudentOnboardings :many
SELECT so.*, vr.full_name AS verified_name, vr.level AS verified_level, vr.department AS verified_department
FROM student_onboardings so
LEFT JOIN verification_records vr ON vr.id = so.verification_record_id
WHERE ($1::onboarding_status IS NULL OR so.status = $1)
AND ($2::int IS NULL OR vr.level = $2)
ORDER BY so.created_at DESC
LIMIT $3 OFFSET $4;

-- name: UpdateStudentOnboardingStatus :exec
UPDATE student_onboardings
SET status = $2, reviewed_by = $3, reviewed_at = NOW(),
    rejection_reason = $4, updated_at = NOW()
WHERE id = $1;

-- name: CountStudentOnboardingsByStatus :many
SELECT status, COUNT(*) as count
FROM student_onboardings
GROUP BY status;

-- name: BulkApproveStudentOnboardings :exec
UPDATE student_onboardings
SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
WHERE id = ANY($1::uuid[]) AND status = 'pending';

-- ==================== ENHANCED ANNOUNCEMENTS ====================

-- name: CreateAnnouncementV2 :one
INSERT INTO announcements (title, content, summary, priority, category, is_pinned,
    target_level, target_audience, target_levels, target_departments, attachments,
    requires_acknowledgment, status, scheduled_for, created_by, pin_order)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
RETURNING *;

-- name: GetAnnouncementV2 :one
SELECT a.*, u.full_name AS author_name
FROM announcements a
JOIN users u ON u.id = a.created_by
WHERE a.id = $1;

-- name: ListAnnouncementsV2 :many
SELECT a.*, u.full_name AS author_name
FROM announcements a
JOIN users u ON u.id = a.created_by
WHERE ($1::announcement_status IS NULL OR a.status = $1)
AND ($2::announcement_priority IS NULL OR a.priority = $2)
AND ($3::announcement_category IS NULL OR a.category = $3)
ORDER BY a.is_pinned DESC, a.pin_order ASC NULLS LAST, a.created_at DESC
LIMIT $4 OFFSET $5;

-- name: ListPublishedAnnouncements :many
SELECT a.*, u.full_name AS author_name
FROM announcements a
JOIN users u ON u.id = a.created_by
WHERE a.status = 'published'
AND (a.expires_at IS NULL OR a.expires_at > NOW())
AND (a.scheduled_for IS NULL OR a.scheduled_for <= NOW())
ORDER BY a.is_pinned DESC, a.pin_order ASC NULLS LAST, a.created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListStudentAnnouncements :many
SELECT a.*, u.full_name AS author_name
FROM announcements a
JOIN users u ON u.id = a.created_by
WHERE a.status = 'published'
AND (a.expires_at IS NULL OR a.expires_at > NOW())
AND (a.scheduled_for IS NULL OR a.scheduled_for <= NOW())
AND (
    a.target_level IS NULL OR a.target_level = $1
)
AND (
    a.target_audience IS NULL OR a.target_audience = '[]'::jsonb
    OR a.target_audience @> to_jsonb($2::text)
)
ORDER BY a.is_pinned DESC, a.pin_order ASC NULLS LAST, a.created_at DESC
LIMIT $3 OFFSET $4;

-- name: UpdateAnnouncementV2 :exec
UPDATE announcements
SET title = COALESCE($2, title), content = COALESCE($3, content),
    summary = COALESCE($4, summary), priority = COALESCE($5, priority),
    category = COALESCE($6, category), is_pinned = COALESCE($7, is_pinned),
    target_level = COALESCE($8, target_level), target_audience = COALESCE($9, target_audience),
    target_levels = COALESCE($10, target_levels), target_departments = COALESCE($11, target_departments),
    attachments = COALESCE($12, attachments), requires_acknowledgment = COALESCE($13, requires_acknowledgment),
    status = COALESCE($14, status), scheduled_for = COALESCE($15, scheduled_for),
    expires_at = COALESCE($16, expires_at), pin_order = $17, updated_at = NOW()
WHERE id = $1;

-- name: DeleteAnnouncementV2 :exec
DELETE FROM announcements WHERE id = $1;

-- name: PublishAnnouncement :exec
UPDATE announcements SET status = 'published', updated_at = NOW()
WHERE id = $1;

-- name: ArchiveAnnouncement :exec
UPDATE announcements SET status = 'archived', updated_at = NOW()
WHERE id = $1;

-- name: CountAnnouncementsByStatus :many
SELECT status, COUNT(*) as count FROM announcements GROUP BY status;

-- name: IncrementAnnouncementReadCount :exec
UPDATE announcements SET read_count = read_count + 1 WHERE id = $1;

-- name: IncrementAnnouncementAckCount :exec
UPDATE announcements SET acknowledged_count = acknowledged_count + 1 WHERE id = $1;

-- name: SearchAnnouncements :many
SELECT a.*, u.full_name AS author_name
FROM announcements a
JOIN users u ON u.id = a.created_by
WHERE a.status = 'published'
AND (a.title ILIKE '%' || $1 || '%' OR a.content ILIKE '%' || $1 || '%')
ORDER BY a.created_at DESC
LIMIT $2 OFFSET $3;

-- ==================== ANNOUNCEMENT READ RECEIPTS ====================

-- name: CreateReadReceipt :one
INSERT INTO announcement_read_receipts (announcement_id, student_id, read_at, device_type)
VALUES ($1, $2, NOW(), $3)
ON CONFLICT (announcement_id, student_id)
DO UPDATE SET read_at = COALESCE(announcement_read_receipts.read_at, NOW())
RETURNING *;

-- name: MarkAnnouncementRead :exec
INSERT INTO announcement_read_receipts (announcement_id, student_id, read_at, device_type)
VALUES ($1, $2, NOW(), $3)
ON CONFLICT (announcement_id, student_id) DO NOTHING;

-- name: AcknowledgeAnnouncement :exec
INSERT INTO announcement_read_receipts (announcement_id, student_id, read_at, acknowledged_at, device_type)
VALUES ($1, $2, NOW(), NOW(), $3)
ON CONFLICT (announcement_id, student_id)
DO UPDATE SET acknowledged_at = COALESCE(announcement_read_receipts.acknowledged_at, NOW()),
              read_at = COALESCE(announcement_read_receipts.read_at, NOW());

-- name: GetReadReceipt :one
SELECT * FROM announcement_read_receipts
WHERE announcement_id = $1 AND student_id = $2;

-- name: ListReadReceiptsByAnnouncement :many
SELECT arr.*, u.full_name AS student_name
FROM announcement_read_receipts arr
JOIN users u ON u.id = arr.student_id
WHERE arr.announcement_id = $1
ORDER BY arr.read_at DESC;

-- name: ListUnacknowledgedStudents :many
SELECT u.id, u.full_name, u.email
FROM users u
JOIN students s ON s.user_id = u.id
WHERE u.is_approved = true AND u.is_active = true
AND NOT EXISTS (
    SELECT 1 FROM announcement_read_receipts arr
    WHERE arr.announcement_id = $1 AND arr.student_id = u.id AND arr.acknowledged_at IS NOT NULL
)
ORDER BY u.full_name;

-- name: HasStudentReadAnnouncement :one
SELECT EXISTS(
    SELECT 1 FROM announcement_read_receipts
    WHERE announcement_id = $1 AND student_id = $2 AND read_at IS NOT NULL
);

-- name: HasStudentAcknowledgedAnnouncement :one
SELECT EXISTS(
    SELECT 1 FROM announcement_read_receipts
    WHERE announcement_id = $1 AND student_id = $2 AND acknowledged_at IS NOT NULL
);

-- name: GetAnnouncementReceiptStats :one
SELECT
    COUNT(*) FILTER (WHERE read_at IS NOT NULL) AS read_count,
    COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL) AS ack_count,
    COUNT(*) AS total_count
FROM announcement_read_receipts
WHERE announcement_id = $1;

-- name: GetStudentReadAnnouncements :many
SELECT a.*, u.full_name AS author_name, arr.read_at, arr.acknowledged_at
FROM announcements a
JOIN users u ON u.id = a.created_by
JOIN announcement_read_receipts arr ON arr.announcement_id = a.id
WHERE arr.student_id = $1 AND arr.read_at IS NOT NULL
ORDER BY arr.read_at DESC
LIMIT $2 OFFSET $3;

-- ==================== ANNOUNCEMENT TEMPLATES ====================

-- name: CreateAnnouncementTemplate :one
INSERT INTO announcement_templates (name, default_title, default_body, default_priority, default_category, default_requires_acknowledgment, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListAnnouncementTemplates :many
SELECT * FROM announcement_templates ORDER BY name;

-- name: GetAnnouncementTemplate :one
SELECT * FROM announcement_templates WHERE id = $1;

-- name: UpdateAnnouncementTemplate :exec
UPDATE announcement_templates
SET name = COALESCE($2, name), default_title = COALESCE($3, default_title),
    default_body = COALESCE($4, default_body), default_priority = COALESCE($5, default_priority),
    default_category = COALESCE($6, default_category),
    default_requires_acknowledgment = COALESCE($7, default_requires_acknowledgment),
    updated_at = NOW()
WHERE id = $1;

-- name: DeleteAnnouncementTemplate :exec
DELETE FROM announcement_templates WHERE id = $1;

-- ==================== ANNOUNCEMENT COMMENTS ====================

-- name: CreateAnnouncementComment :one
INSERT INTO announcement_comments (announcement_id, author_id, parent_comment_id, content)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListAnnouncementComments :many
SELECT ac.*, u.full_name AS author_name
FROM announcement_comments ac
JOIN users u ON u.id = ac.author_id
WHERE ac.announcement_id = $1 AND ac.is_hidden = false
ORDER BY ac.created_at ASC;

-- name: DeleteAnnouncementComment :exec
DELETE FROM announcement_comments WHERE id = $1 AND author_id = $2;

-- name: HideAnnouncementComment :exec
UPDATE announcement_comments SET is_hidden = true WHERE id = $1;

-- ==================== LOOKUP QUERIES ====================

-- name: UpdateUserApproval :exec
UPDATE users SET is_approved = $2, approved_by = $3, approved_at = NOW() WHERE id = $1;
