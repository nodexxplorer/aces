-- ==================== CAMPUS PROFILES ====================

-- name: UpsertCampusProfile :one
INSERT INTO campus_profiles (user_id, bio, interests, skills, availability_status)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id) DO UPDATE
SET bio = EXCLUDED.bio, interests = EXCLUDED.interests, skills = EXCLUDED.skills,
    availability_status = EXCLUDED.availability_status, updated_at = NOW()
RETURNING *;

-- name: GetCampusProfile :one
SELECT * FROM campus_profiles WHERE user_id = $1;

-- name: UpdateCampusProfileAvailability :exec
UPDATE campus_profiles SET availability_status = $2, last_active_at = NOW(), updated_at = NOW()
WHERE user_id = $1;

-- name: UpdateCampusProfileActivity :exec
UPDATE campus_profiles SET last_active_at = NOW() WHERE user_id = $1;

-- name: IncrementProfilePostCount :exec
UPDATE campus_profiles SET post_count = post_count + 1 WHERE user_id = $1;

-- name: IncrementProfileConnectionCount :exec
UPDATE campus_profiles SET connection_count = connection_count + 1 WHERE user_id = $1;

-- name: DecrementProfileConnectionCount :exec
UPDATE campus_profiles SET connection_count = GREATEST(connection_count - 1, 0) WHERE user_id = $1;

-- name: SearchCampusProfiles :many
SELECT cp.*, u.full_name, u.avatar_url, u.role
FROM campus_profiles cp
JOIN users u ON u.id = cp.user_id
WHERE u.is_active = true AND u.is_approved = true
  AND ($1 = '' OR cp.skills @> to_jsonb($1::text) OR cp.interests @> to_jsonb($1::text) OR u.full_name ILIKE '%' || $1 || '%')
ORDER BY cp.last_active_at DESC
LIMIT $2 OFFSET $3;

-- ==================== FEED POSTS ====================

-- name: CreateFeedPost :one
INSERT INTO feed_posts (author_id, post_type, content, media_urls, target_audience, group_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetFeedPost :one
SELECT fp.*, u.full_name AS author_name, u.avatar_url AS author_avatar, u.role AS author_role
FROM feed_posts fp
JOIN users u ON u.id = fp.author_id
WHERE fp.id = $1;

-- name: ListFeedPosts :many
SELECT fp.*, u.full_name AS author_name, u.avatar_url AS author_avatar, u.role AS author_role,
       EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = fp.id AND pr.user_id = $1) AS user_liked
FROM feed_posts fp
JOIN users u ON u.id = fp.author_id
WHERE fp.is_hidden = false
  AND (fp.target_audience = 'public'
       OR fp.author_id = $1
       OR (fp.target_audience = 'connections' AND EXISTS(
           SELECT 1 FROM connections c
           WHERE c.status = 'accepted'
             AND ((c.requester_id = $1 AND c.receiver_id = fp.author_id)
                  OR (c.receiver_id = $1 AND c.requester_id = fp.author_id))
       ))
       OR (fp.target_audience = 'group' AND fp.group_id IS NOT NULL AND EXISTS(
           SELECT 1 FROM group_members gm WHERE gm.group_id = fp.group_id AND gm.user_id = $1
       ))
  )
ORDER BY fp.is_pinned DESC, fp.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListGroupFeedPosts :many
SELECT fp.*, u.full_name AS author_name, u.avatar_url AS author_avatar,
       EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = fp.id AND pr.user_id = $1) AS user_liked
FROM feed_posts fp
JOIN users u ON u.id = fp.author_id
WHERE fp.group_id = $2 AND fp.is_hidden = false
ORDER BY fp.created_at DESC
LIMIT $3 OFFSET $4;

-- name: UpdateFeedPost :exec
UPDATE feed_posts
SET content = $2, media_urls = $3, updated_at = NOW()
WHERE id = $1 AND author_id = $4;

-- name: HideFeedPost :exec
UPDATE feed_posts SET is_hidden = true WHERE id = $1;

-- name: PinFeedPost :exec
UPDATE feed_posts SET is_pinned = $2 WHERE id = $1;

-- name: DeleteFeedPost :exec
DELETE FROM feed_posts WHERE id = $1 AND author_id = $2;

-- name: IncrementPostLikeCount :exec
UPDATE feed_posts SET like_count = like_count + 1 WHERE id = $1;

-- name: DecrementPostLikeCount :exec
UPDATE feed_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1;

-- name: IncrementPostCommentCount :exec
UPDATE feed_posts SET comment_count = comment_count + 1 WHERE id = $1;

-- name: IncrementPostShareCount :exec
UPDATE feed_posts SET share_count = share_count + 1 WHERE id = $1;

-- ==================== POST REACTIONS ====================

-- name: CreatePostReaction :one
INSERT INTO post_reactions (post_id, user_id, reaction_type)
VALUES ($1, $2, $3)
ON CONFLICT (post_id, user_id) DO UPDATE
SET reaction_type = EXCLUDED.reaction_type, created_at = NOW()
RETURNING *;

-- name: RemovePostReaction :exec
DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2;

-- name: GetPostReaction :one
SELECT * FROM post_reactions WHERE post_id = $1 AND user_id = $2;

-- name: ListPostReactions :many
SELECT pr.*, u.full_name
FROM post_reactions pr
JOIN users u ON u.id = pr.user_id
WHERE pr.post_id = $1
ORDER BY pr.created_at DESC;

-- name: GetPostReactionCounts :many
SELECT reaction_type, COUNT(*)::int AS count
FROM post_reactions WHERE post_id = $1
GROUP BY reaction_type;

-- ==================== POST COMMENTS ====================

-- name: CreatePostComment :one
INSERT INTO post_comments (post_id, author_id, parent_comment_id, content)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListPostComments :many
SELECT pc.*, u.full_name AS author_name, u.avatar_url AS author_avatar
FROM post_comments pc
JOIN users u ON u.id = pc.author_id
WHERE pc.post_id = $1 AND pc.parent_comment_id IS NULL
ORDER BY pc.created_at ASC
LIMIT $2 OFFSET $3;

-- name: ListCommentReplies :many
SELECT pc.*, u.full_name AS author_name, u.avatar_url AS author_avatar
FROM post_comments pc
JOIN users u ON u.id = pc.author_id
WHERE pc.parent_comment_id = $1
ORDER BY pc.created_at ASC;

-- name: DeletePostComment :exec
DELETE FROM post_comments WHERE id = $1 AND author_id = $2;

-- name: IncrementCommentLikeCount :exec
UPDATE post_comments SET like_count = like_count + 1 WHERE id = $1;

-- name: DecrementCommentLikeCount :exec
UPDATE post_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1;

-- ==================== COMMENT REACTIONS ====================

-- name: CreateCommentReaction :one
INSERT INTO comment_reactions (comment_id, user_id, reaction_type)
VALUES ($1, $2, $3)
ON CONFLICT (comment_id, user_id) DO UPDATE
SET reaction_type = EXCLUDED.reaction_type, created_at = NOW()
RETURNING *;

-- name: RemoveCommentReaction :exec
DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2;

-- name: GetCommentReaction :one
SELECT * FROM comment_reactions WHERE comment_id = $1 AND user_id = $2;

-- ==================== MESSAGE REACTIONS ====================

-- name: CreateMessageReaction :one
INSERT INTO message_reactions (message_id, user_id, reaction_type)
VALUES ($1, $2, $3)
ON CONFLICT (message_id, user_id) DO UPDATE
SET reaction_type = EXCLUDED.reaction_type, created_at = NOW()
RETURNING *;

-- name: GetMessageReaction :one
SELECT * FROM message_reactions WHERE message_id = $1 AND user_id = $2;

-- name: RemoveMessageReaction :exec
DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2;

-- name: GetMessageReactions :many
SELECT mr.*, u.full_name
FROM message_reactions mr
JOIN users u ON u.id = mr.user_id
WHERE mr.message_id = $1;

-- ==================== GROUP FILES ====================

-- name: CreateGroupFile :one
INSERT INTO group_files (group_id, uploaded_by, file_name, file_url, file_type, file_size)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListGroupFiles :many
SELECT gf.*, u.full_name AS uploaded_by_name
FROM group_files gf
JOIN users u ON u.id = gf.uploaded_by
WHERE gf.group_id = $1
ORDER BY gf.created_at DESC;

-- name: DeleteGroupFile :exec
DELETE FROM group_files WHERE id = $1 AND group_id = $2;

-- ==================== CONNECTION SUGGESTIONS ====================

-- name: GetConnectionSuggestions :many
SELECT u.id, u.full_name, u.avatar_url, u.role,
       s.matric_number, s.level,
       COALESCE(cp.bio, '') AS bio,
       COALESCE(cp.skills, '[]') AS skills,
       COALESCE(cp.interests, '[]') AS interests,
       CASE WHEN s.department IS NOT NULL THEN s.department ELSE '' END AS department,
       (
         CASE WHEN EXISTS(SELECT 1 FROM connections c WHERE c.status = 'accepted'
           AND ((c.requester_id = $1 AND c.receiver_id = u.id) OR (c.receiver_id = u.id AND c.requester_id = $1)))
         THEN 1 ELSE 0 END
       ) AS is_connected,
       (
         CASE WHEN EXISTS(SELECT 1 FROM connections c WHERE c.status = 'pending' AND c.requester_id = $1 AND c.receiver_id = u.id)
         THEN 1 ELSE 0 END
       ) AS request_sent
FROM users u
LEFT JOIN students s ON s.user_id = u.id
LEFT JOIN campus_profiles cp ON cp.user_id = u.id
WHERE u.id != $1 AND u.is_active = true AND u.is_approved = true
  AND NOT EXISTS(
      SELECT 1 FROM connections c
      WHERE c.status = 'accepted'
        AND ((c.requester_id = $1 AND c.receiver_id = u.id) OR (c.receiver_id = u.id AND c.requester_id = $1))
  )
ORDER BY
  (CASE WHEN s.department = (SELECT department FROM students WHERE user_id = $1) THEN 25 ELSE 0 END) +
  (CASE WHEN s.level = (SELECT level FROM students WHERE user_id = $1) THEN 20 ELSE 0 END) +
  (CASE WHEN cp.availability_status = 'online' THEN 5 ELSE 0 END)
  DESC
LIMIT $2;

-- name: SearchPeople :many
SELECT u.id, u.full_name, u.avatar_url, u.role, u.email,
       s.matric_number, s.level,
       COALESCE(cp.bio, '') AS bio,
       COALESCE(cp.skills, '[]') AS skills,
       COALESCE(cp.interests, '[]') AS interests,
       COALESCE(cp.availability_status, 'offline') AS availability_status
FROM users u
LEFT JOIN students s ON s.user_id = u.id
LEFT JOIN campus_profiles cp ON cp.user_id = u.id
WHERE u.is_active = true AND u.is_approved = true
  AND (u.full_name ILIKE '%' || $1 || '%' OR s.matric_number ILIKE '%' || $1 || '%')
ORDER BY u.full_name
LIMIT $2 OFFSET $3;

-- ==================== CAMPUS REPORTS ====================

-- name: CreateCampusReport :one
INSERT INTO campus_reports (reporter_id, target_type, target_id, reason, description)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListCampusReports :many
SELECT cr.*, u.full_name AS reporter_name
FROM campus_reports cr
JOIN users u ON u.id = cr.reporter_id
WHERE ($1 = '' OR cr.status = $1)
ORDER BY cr.created_at DESC;

-- name: UpdateCampusReportStatus :exec
UPDATE campus_reports
SET status = $2, reviewed_by = $3, reviewed_at = NOW(), action_taken = $4
WHERE id = $1;

-- name: CountUserReports :one
SELECT COUNT(*)::int AS report_count
FROM campus_reports
WHERE target_id = $1 AND target_type = $2 AND status = 'pending';

-- ==================== CONNECTION STRIKES ====================

-- name: CreateConnectionStrike :one
INSERT INTO connection_strikes (user_id, reason, strike_number, issued_by, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetUserStrikes :many
SELECT * FROM connection_strikes WHERE user_id = $1 ORDER BY created_at DESC;

-- name: GetUserStrikeCount :one
SELECT COUNT(*)::int AS strike_count
FROM connection_strikes
WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW());

-- name: ClearUserStrikes :exec
DELETE FROM connection_strikes WHERE user_id = $1;

-- ==================== POST BOOKMARKS ====================

-- name: CreatePostBookmark :exec
INSERT INTO post_bookmarks (user_id, post_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: RemovePostBookmark :exec
DELETE FROM post_bookmarks WHERE user_id = $1 AND post_id = $2;

-- name: ListUserBookmarks :many
SELECT fp.*, u.full_name AS author_name, u.avatar_url AS author_avatar
FROM post_bookmarks pb
JOIN feed_posts fp ON fp.id = pb.post_id
JOIN users u ON u.id = fp.author_id
WHERE pb.user_id = $1
ORDER BY pb.created_at DESC;

-- name: IsPostBookmarked :one
SELECT EXISTS(SELECT 1 FROM post_bookmarks WHERE user_id = $1 AND post_id = $2) AS bookmarked;
