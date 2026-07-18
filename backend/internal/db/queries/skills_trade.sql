-- ==================== SKILL CATEGORIES ====================

-- name: CreateSkillCategory :one
INSERT INTO skill_categories (name, description, icon) VALUES ($1, $2, $3) RETURNING *;

-- name: GetSkillCategory :one
SELECT * FROM skill_categories WHERE id = $1 LIMIT 1;

-- name: ListSkillCategories :many
SELECT * FROM skill_categories WHERE is_active = true ORDER BY name;

-- ==================== SKILL LISTINGS ====================

-- name: CreateSkillListing :one
INSERT INTO skill_listings (
    user_id, category_id, title, description, skill_level, price, is_free, barter_available, barter_description, portfolio_url
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- name: GetSkillListing :one
SELECT sl.*, sc.name AS category_name, u.full_name AS owner_name, u.avatar_url AS owner_avatar
FROM skill_listings sl
JOIN skill_categories sc ON sl.category_id = sc.id
JOIN users u ON sl.user_id = u.id
WHERE sl.id = $1 LIMIT 1;

-- name: ListSkillListings :many
SELECT sl.*, sc.name AS category_name, u.full_name AS owner_name, u.avatar_url AS owner_avatar
FROM skill_listings sl
JOIN skill_categories sc ON sl.category_id = sc.id
JOIN users u ON sl.user_id = u.id
WHERE sl.is_active = true
ORDER BY sl.created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListUserSkillListings :many
SELECT sl.*, sc.name AS category_name
FROM skill_listings sl
JOIN skill_categories sc ON sl.category_id = sc.id
WHERE sl.user_id = $1 AND sl.is_active = true
ORDER BY sl.created_at DESC;

-- name: UpdateSkillListing :one
UPDATE skill_listings
SET title = $2, description = $3, skill_level = $4, price = $5, is_free = $6, barter_available = $7, barter_description = $8, portfolio_url = $9, is_active = $10, updated_at = NOW()
WHERE id = $1 RETURNING *;

-- name: DeleteSkillListing :exec
UPDATE skill_listings SET is_active = false, updated_at = NOW() WHERE id = $1;

-- ==================== TRADE OFFERS ====================

-- name: CreateTradeOffer :one
INSERT INTO trade_offers (from_user_id, to_user_id, offered_skill_id, requested_skill_id, message, price_offered, is_barter)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: GetTradeOffer :one
SELECT * FROM trade_offers WHERE id = $1 LIMIT 1;

-- name: ListUserTradeOffers :many
SELECT * FROM trade_offers
WHERE from_user_id = $1 OR to_user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateTradeOfferStatus :one
UPDATE trade_offers SET status = $2,
    responded_at = CASE WHEN $2 IN ('accepted', 'cancelled') THEN NOW() ELSE responded_at END,
    completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END
WHERE id = $1 RETURNING *;

-- ==================== SKILL RATINGS ====================

-- name: CreateSkillRating :one
INSERT INTO skill_ratings (trade_id, rater_id, rated_user_id, rating, review)
VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: ListUserSkillRatings :many
SELECT sr.*, u.full_name AS rater_name
FROM skill_ratings sr JOIN users u ON sr.rater_id = u.id
WHERE sr.rated_user_id = $1
ORDER BY sr.created_at DESC LIMIT $2 OFFSET $3;

-- ==================== USER REPUTATION ====================

-- name: GetUserReputation :one
SELECT * FROM user_reputation WHERE user_id = $1 LIMIT 1;

-- name: UpsertUserReputation :one
INSERT INTO user_reputation (user_id, total_ratings, average_rating, total_trades_completed, reputation_score)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id) DO UPDATE
SET total_ratings = $2, average_rating = $3, total_trades_completed = $4, reputation_score = $5, updated_at = NOW()
RETURNING *;
