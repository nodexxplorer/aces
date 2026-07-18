-- name: GetDonation :one
SELECT * FROM alumni_donations WHERE id = $1 LIMIT 1;

-- name: GetDonorTotal :one
SELECT COALESCE(SUM(amount), 0) as total
FROM alumni_donations
WHERE donor_id = $1 AND status = 'completed';

-- name: UpdateDonationStatus :exec
UPDATE alumni_donations SET status = $2 WHERE id = $1;
