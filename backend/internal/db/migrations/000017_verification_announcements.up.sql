-- ==================== VERIFICATION RECORDS ====================
-- Official departmental database (read-only for the app)

CREATE TABLE verification_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matric_number VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    level INTEGER NOT NULL,
    entry_session VARCHAR(20) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Computer Engineering',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_records_matric ON verification_records(matric_number);
CREATE INDEX idx_verification_records_name ON verification_records(full_name);

-- ==================== ENHANCED STUDENT ONBOARDING ====================

DO $$ BEGIN
    CREATE TYPE onboarding_status AS ENUM ('pending', 'approved', 'rejected', 're_verification_required');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE student_onboardings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matric_number VARCHAR(50) NOT NULL,
    verification_record_id UUID REFERENCES verification_records(id),
    match_confidence REAL DEFAULT 0,
    submitted_email VARCHAR(255),
    submitted_phone VARCHAR(20),
    status onboarding_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_student_onboardings_status ON student_onboardings(status);
CREATE INDEX idx_student_onboardings_matric ON student_onboardings(matric_number);
CREATE INDEX idx_student_onboardings_user ON student_onboardings(user_id);

-- ==================== ENHANCED ANNOUNCEMENTS ====================

DO $$ BEGIN
    CREATE TYPE announcement_priority AS ENUM ('urgent', 'important', 'general', 'reminder');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE announcement_category AS ENUM ('academic', 'administrative', 'event', 'emergency', 'fee', 'result');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE announcement_status AS ENUM ('draft', 'scheduled', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS summary VARCHAR(300),
    ADD COLUMN IF NOT EXISTS priority announcement_priority NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS category announcement_category NOT NULL DEFAULT 'academic',
    ADD COLUMN IF NOT EXISTS target_levels JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS target_departments JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS status announcement_status NOT NULL DEFAULT 'published',
    ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS read_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS acknowledged_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pin_order INTEGER,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Migrate existing pinned announcements
UPDATE announcements SET pin_order = 1 WHERE is_pinned = true AND pin_order IS NULL;

-- ==================== ANNOUNCEMENT READ RECEIPTS ====================

CREATE TABLE announcement_read_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    device_type VARCHAR(20) DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(announcement_id, student_id)
);

CREATE INDEX idx_receipts_announcement ON announcement_read_receipts(announcement_id);
CREATE INDEX idx_receipts_student ON announcement_read_receipts(student_id);

-- ==================== ANNOUNCEMENT TEMPLATES ====================

CREATE TABLE announcement_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    default_title VARCHAR(255) NOT NULL,
    default_body TEXT NOT NULL,
    default_priority announcement_priority NOT NULL DEFAULT 'general',
    default_category announcement_category NOT NULL DEFAULT 'academic',
    default_requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default templates
INSERT INTO announcement_templates (name, default_title, default_body, default_priority, default_category, default_requires_acknowledgment) VALUES
('Exam Notice', 'Exam Registration Opens', 'Dear students,\n\nRegistration for examinations will commence shortly. Please ensure all requirements are met.\n\nBest regards.', 'urgent', 'academic', true),
('Fee Reminder', 'Departmental Dues Reminder', 'Dear students,\n\nThis is a reminder that departmental dues are outstanding. Please clear all dues to avoid restrictions.\n\nBest regards.', 'important', 'fee', true),
('Event Invite', 'Departmental Event', 'Dear students,\n\nYou are cordially invited to an upcoming departmental event. See details below.\n\nBest regards.', 'general', 'event', false),
('Emergency Alert', 'Emergency Notice', 'URGENT: Please read this emergency notice carefully and take immediate action as required.', 'urgent', 'emergency', true),
('Welcome Back', 'Welcome Back Message', 'Dear students,\n\nWelcome to a new semester! We wish you academic success.\n\nBest regards.', 'general', 'administrative', false),
('Result Release', 'Results Published', 'Dear students,\n\nResults for the previous semester have been published. Check your transcripts for details.\n\nBest regards.', 'important', 'result', false);

-- ==================== ANNOUNCEMENT COMMENTS ====================

CREATE TABLE announcement_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES announcement_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcement_comments_announcement ON announcement_comments(announcement_id);
