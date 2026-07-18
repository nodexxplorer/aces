-- ==================== MANUALS ====================

-- name: CreateManual :one
INSERT INTO manuals (
    title, description, level, price, file_url, cover_image_url, course_id, session_id, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetManual :one
SELECT * FROM manuals
WHERE id = $1 LIMIT 1;

-- name: ListManuals :many
SELECT * FROM manuals
WHERE is_active = true
ORDER BY level, title
LIMIT $1 OFFSET $2;

-- name: ListManualsByLevel :many
SELECT * FROM manuals
WHERE is_active = true AND level = $1
ORDER BY title;

-- name: UpdateManual :one
UPDATE manuals
SET title = $2, description = $3, level = $4, price = $5,
    file_url = $6, cover_image_url = $7, is_active = $8,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteManual :exec
UPDATE manuals SET is_active = false, updated_at = NOW() WHERE id = $1;

-- ==================== MANUAL PURCHASES ====================

-- name: CreateManualPurchase :one
INSERT INTO manual_purchases (
    student_id, manual_id, payment_id, qr_code_data, qr_code_url
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetManualPurchase :one
SELECT * FROM manual_purchases
WHERE id = $1 LIMIT 1;

-- name: ListStudentManualPurchases :many
SELECT mp.*, m.title, m.level, m.price
FROM manual_purchases mp
JOIN manuals m ON mp.manual_id = m.id
WHERE mp.student_id = $1
ORDER BY mp.purchased_at DESC;

-- name: ListManualPurchasesByManual :many
SELECT mp.*, s.matric_number, u.full_name
FROM manual_purchases mp
JOIN students s ON mp.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE mp.manual_id = $1
ORDER BY mp.purchased_at DESC
LIMIT $2 OFFSET $3;

-- name: MarkManualCollected :one
UPDATE manual_purchases
SET is_collected = true, collected_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CheckManualPurchased :one
SELECT EXISTS(
    SELECT 1 FROM manual_purchases
    WHERE student_id = $1 AND manual_id = $2
) AS is_purchased;

-- ==================== MANUAL PRINT QUEUE ====================

-- name: CreatePrintQueueItem :one
INSERT INTO manual_print_queue (
    purchase_id, student_id, manual_id
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: ListPrintQueue :many
SELECT mpq.*, m.title AS manual_title, u.full_name AS student_name, s.matric_number
FROM manual_print_queue mpq
JOIN manuals m ON mpq.manual_id = m.id
JOIN students s ON mpq.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE mpq.status = COALESCE($1, mpq.status)
ORDER BY mpq.queued_at
LIMIT $2 OFFSET $3;

-- name: UpdatePrintQueueStatus :one
UPDATE manual_print_queue
SET status = $2, processed_by = $3,
    printed_at = CASE WHEN $2 = 'ready' THEN NOW() ELSE printed_at END,
    collected_at = CASE WHEN $2 = 'collected' THEN NOW() ELSE collected_at END
WHERE id = $1
RETURNING *;

-- ==================== PRACTICAL ENROLLMENTS ====================

-- name: CreatePracticalEnrollment :one
INSERT INTO practical_enrollments (
    student_id, course_id, manual_purchase_id, session_id, enrolled_via
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: ListStudentPracticalEnrollments :many
SELECT pe.*, c.code AS course_code, c.title AS course_title
FROM practical_enrollments pe
JOIN courses c ON pe.course_id = c.id
WHERE pe.student_id = $1
ORDER BY pe.enrolled_at DESC;

-- name: CheckPracticalEnrolled :one
SELECT EXISTS(
    SELECT 1 FROM practical_enrollments
    WHERE student_id = $1 AND course_id = $2 AND session_id = $3
) AS is_enrolled;
