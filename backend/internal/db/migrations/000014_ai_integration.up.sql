-- AI Integration Migration
-- Tables for chatbot interactions, predictions, models, content moderation, and AI settings

-- ==================== ENUMS ====================

CREATE TYPE ai_feature AS ENUM (
    'chatbot', 'recommendation', 'prediction', 'moderation', 'search', 'plagiarism', 'face_recognition', 'translation'
);

CREATE TYPE ai_model_type AS ENUM (
    'llm', 'ml', 'nlp', 'vision', 'speech', 'rule_based'
);

CREATE TYPE ai_model_status AS ENUM (
    'active', 'deprecated', 'retraining'
);

CREATE TYPE moderation_content_type AS ENUM (
    'post', 'message', 'comment', 'assignment', 'announcement'
);

CREATE TYPE moderation_decision AS ENUM (
    'allow', 'remove', 'escalate'
);

-- ==================== AI INTERACTIONS ====================

CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature ai_feature NOT NULL DEFAULT 'chatbot',
    session_id VARCHAR(100), -- groups messages in a single conversation
    input_text TEXT NOT NULL,
    output_text TEXT NOT NULL,
    confidence_score FLOAT DEFAULT 0.0,
    was_accurate BOOLEAN,
    user_feedback VARCHAR(20), -- 'positive', 'negative', 'neutral'
    context JSONB DEFAULT '{}', -- additional context: course_id, student_id, etc.
    model_used VARCHAR(100) DEFAULT 'rule_based',
    response_time_ms INTEGER,
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_interactions_user ON ai_interactions(user_id);
CREATE INDEX idx_ai_interactions_feature ON ai_interactions(feature);
CREATE INDEX idx_ai_interactions_session ON ai_interactions(session_id);
CREATE INDEX idx_ai_interactions_created ON ai_interactions(created_at);

-- ==================== AI PREDICTIONS ====================

CREATE TYPE prediction_type AS ENUM (
    'at_risk', 'pass_rate', 'revenue', 'defaulter', 'gpa', 'attendance', 'completion'
);

CREATE TABLE ai_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_type prediction_type NOT NULL,
    target_id UUID NOT NULL, -- student_id, course_id, or session_id
    predicted_value JSONB NOT NULL,
    actual_value JSONB,
    confidence_interval FLOAT DEFAULT 0.0,
    model_version VARCHAR(50) DEFAULT '1.0.0',
    features_used JSONB DEFAULT '{}',
    was_reviewed BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_predictions_type ON ai_predictions(prediction_type);
CREATE INDEX idx_ai_predictions_target ON ai_predictions(target_id);
CREATE INDEX idx_ai_predictions_created ON ai_predictions(created_at);

-- ==================== AI MODELS ====================

CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    model_type ai_model_type NOT NULL,
    training_data_summary JSONB DEFAULT '{}',
    accuracy_metrics JSONB DEFAULT '{}',
    bias_audit_results JSONB,
    deployment_status ai_model_status NOT NULL DEFAULT 'active',
    config JSONB DEFAULT '{}', -- model-specific configuration
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_models_name ON ai_models(model_name);
CREATE INDEX idx_ai_models_status ON ai_models(deployment_status);

-- ==================== CONTENT MODERATION LOG ====================

CREATE TABLE content_moderation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL,
    content_type moderation_content_type NOT NULL,
    ai_flagged BOOLEAN DEFAULT false,
    ai_confidence FLOAT DEFAULT 0.0,
    ai_reason TEXT,
    human_reviewed BOOLEAN DEFAULT false,
    human_decision moderation_decision,
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_moderation_content ON content_moderation_log(content_id);
CREATE INDEX idx_moderation_flagged ON content_moderation_log(ai_flagged);
CREATE INDEX idx_moderation_pending ON content_moderation_log(human_reviewed) WHERE human_reviewed = false;

-- ==================== AI SETTINGS (per user) ====================

CREATE TABLE ai_user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    chatbot_enabled BOOLEAN DEFAULT true,
    personalization_enabled BOOLEAN DEFAULT true,
    face_recognition_enabled BOOLEAN DEFAULT false,
    data_collection_consent BOOLEAN DEFAULT false,
    preferred_language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_settings_user ON ai_user_settings(user_id);

-- ==================== SEED AI MODELS ====================

INSERT INTO ai_models (model_name, model_version, model_type, deployment_status, config) VALUES
('aces_chatbot', '1.0.0', 'rule_based', 'active', '{"description": "Rule-based chatbot with academic Q&A", "fallback": true}'),
('aces_chatbot_llm', '1.0.0', 'llm', 'deprecated', '{"description": "LLM-powered chatbot (requires API key)", "requires_api_key": true}');

-- ==================== TRIGGER ====================

CREATE TRIGGER update_ai_models_updated_at BEFORE UPDATE ON ai_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_user_settings_updated_at BEFORE UPDATE ON ai_user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
