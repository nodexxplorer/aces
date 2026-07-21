-- name: CreateAIInteraction :one
INSERT INTO ai_interactions (user_id, feature, session_id, input_text, output_text, confidence_score, context, model_used, response_time_ms)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListAIInteractionsByUser :many
SELECT * FROM ai_interactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAIInteractionsBySession :many
SELECT * FROM ai_interactions
WHERE session_id = $1 AND user_id = $2
ORDER BY created_at ASC;

-- name: UpdateAIInteractionFeedback :exec
UPDATE ai_interactions SET user_feedback = $2, was_accurate = $3 WHERE id = $1;

-- name: GetAIInteractionStats :one
SELECT
    COUNT(*) as total_interactions,
    COUNT(DISTINCT user_id) as unique_users,
    COALESCE(AVG(confidence_score), 0) as avg_confidence,
    COALESCE(AVG(response_time_ms), 0) as avg_response_time
FROM ai_interactions
WHERE created_at >= COALESCE($1, NOW() - INTERVAL '30 days');

-- name: CreateAIPrediction :one
INSERT INTO ai_predictions (prediction_type, target_id, predicted_value, confidence_interval, model_version, features_used)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListAIPredictionsByType :many
SELECT * FROM ai_predictions
WHERE prediction_type = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: UpdateAIPredictionActual :exec
UPDATE ai_predictions SET actual_value = $2, was_reviewed = $3, reviewed_by = $4 WHERE id = $1;

-- name: CreateAIModel :one
INSERT INTO ai_models (model_name, model_version, model_type, training_data_summary, accuracy_metrics, config)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetAIModelByName :one
SELECT * FROM ai_models WHERE model_name = $1;

-- name: ListAIModels :many
SELECT * FROM ai_models ORDER BY created_at DESC;

-- name: UpdateAIModelStatus :exec
UPDATE ai_models SET deployment_status = $2 WHERE id = $1;

-- name: CreateContentModerationLog :one
INSERT INTO content_moderation_log (content_id, content_type, ai_flagged, ai_confidence, ai_reason)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListPendingModerations :many
SELECT * FROM content_moderation_log
WHERE human_reviewed = false
ORDER BY created_at DESC
LIMIT $1;

-- name: UpdateModerationDecision :exec
UPDATE content_moderation_log
SET human_reviewed = true, human_decision = $2, reviewed_by = $3, reviewed_at = NOW()
WHERE id = $1;

-- name: GetOrCreateAISettings :one
INSERT INTO ai_user_settings (user_id) VALUES ($1)
ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
RETURNING *;

-- name: UpdateAISettings :exec
UPDATE ai_user_settings SET
    chatbot_enabled = COALESCE($2, chatbot_enabled),
    personalization_enabled = COALESCE($3, personalization_enabled),
    face_recognition_enabled = COALESCE($4, face_recognition_enabled),
    data_collection_consent = COALESCE($5, data_collection_consent),
    preferred_language = COALESCE($6, preferred_language)
WHERE user_id = $1;

-- name: GetAISettings :one
SELECT * FROM ai_user_settings WHERE user_id = $1;

-- name: GetTodayInteractionCount :one
SELECT COUNT(*)::int FROM ai_interactions
WHERE user_id = $1 AND created_at >= CURRENT_DATE;
