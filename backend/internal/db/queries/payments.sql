-- ==================== DUES ====================

-- name: CreateDue :one
INSERT INTO dues (
    name, description, type, amount, level, session_id, semester_id, deadline, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetDue :one
SELECT * FROM dues
WHERE id = $1 LIMIT 1;

-- name: ListDues :many
SELECT * FROM dues
WHERE is_active = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListDuesByLevel :many
SELECT * FROM dues
WHERE is_active = true AND (level IS NULL OR level = $1)
ORDER BY created_at DESC;

-- name: UpdateDue :one
UPDATE dues
SET
    name = $2,
    description = $3,
    type = $4,
    amount = $5,
    level = $6,
    deadline = $7,
    is_active = $8
WHERE id = $1
RETURNING *;

-- name: DeleteDue :exec
UPDATE dues SET is_active = false WHERE id = $1;

-- ==================== PAYMENT CART ====================

-- name: AddToCart :one
INSERT INTO payment_cart (
    student_id, due_id, amount
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: GetCartItem :one
SELECT * FROM payment_cart
WHERE id = $1 LIMIT 1;

-- name: ListStudentCart :many
SELECT * FROM payment_cart
WHERE student_id = $1
ORDER BY added_at DESC;

-- name: RemoveFromCart :exec
DELETE FROM payment_cart WHERE id = $1;

-- name: ClearStudentCart :exec
DELETE FROM payment_cart WHERE student_id = $1;

-- ==================== PAYMENT BATCHES ====================

-- name: CreatePaymentBatch :one
INSERT INTO payment_batches (
    student_id, total_amount, paystack_reference, status
) VALUES (
    $1, $2, $3, 'pending'
) RETURNING *;

-- name: GetPaymentBatch :one
SELECT * FROM payment_batches
WHERE id = $1 LIMIT 1;

-- name: ListStudentPaymentBatches :many
SELECT * FROM payment_batches
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdatePaymentBatchStatus :one
UPDATE payment_batches
SET
    status = $2,
    paid_at = $3,
    receipt_url = $4
WHERE id = $1
RETURNING *;

-- ==================== PAYMENTS ====================

-- name: CreatePayment :one
INSERT INTO payments (
    student_id, batch_id, due_id, type, item_name, amount, paystack_reference, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, 'pending'
) RETURNING *;

-- name: GetPayment :one
SELECT * FROM payments
WHERE id = $1 LIMIT 1;

-- name: ListStudentPayments :many
SELECT * FROM payments
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListBatchPayments :many
SELECT * FROM payments
WHERE batch_id = $1
ORDER BY created_at;

-- name: UpdatePaymentStatus :one
UPDATE payments
SET
    status = $2,
    paid_at = $3
WHERE id = $1
RETURNING *;

-- name: VerifyPayment :one
UPDATE payments
SET
    status = 'completed',
    verified_by = $2,
    verified_at = NOW(),
    paid_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetStudentPaymentSummary :one
SELECT
    COUNT(*) FILTER (WHERE status = 'completed') AS total_paid,
    COUNT(*) FILTER (WHERE status = 'pending') AS total_pending,
    COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::DECIMAL(10,2) AS amount_paid,
    COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::DECIMAL(10,2) AS amount_pending
FROM payments
WHERE student_id = $1;

-- name: CheckDuePaid :one
SELECT EXISTS(
    SELECT 1 FROM payments
    WHERE student_id = $1 AND due_id = $2 AND status = 'completed'
) AS is_paid;

-- name: ListAllPayments :many
SELECT p.*, s.matric_number, u.full_name AS student_name, d.name AS due_name
FROM payments p
JOIN students s ON s.id = p.student_id
JOIN users u ON u.id = s.user_id
LEFT JOIN dues d ON d.id = p.due_id
ORDER BY p.created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetPaymentByReference :one
SELECT p.*, s.matric_number, u.full_name AS student_name, d.name AS due_name
FROM payments p
JOIN students s ON s.id = p.student_id
JOIN users u ON u.id = s.user_id
LEFT JOIN dues d ON d.id = p.due_id
WHERE p.paystack_reference = $1
LIMIT 1;

-- name: ListDefaultersByLevel :many
SELECT
    s.id AS student_id,
    u.full_name,
    s.matric_number,
    s.level,
    COUNT(d.id)::INT AS unpaid_dues_count,
    COALESCE(SUM(d.amount), 0)::DECIMAL(10,2) AS total_outstanding
FROM students s
JOIN users u ON u.id = s.user_id
CROSS JOIN dues d
WHERE d.is_active = true
  AND (d.level IS NULL OR d.level = s.level)
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.student_id = s.id AND p.due_id = d.id AND p.status = 'completed'
  )
GROUP BY s.id, u.full_name, s.matric_number, s.level
HAVING COUNT(d.id) > 0
ORDER BY total_outstanding DESC;
