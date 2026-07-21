-- Additional Features Migration
-- Password reset, account lockout, session management, grade appeals, study tasks,
-- class notices, staff meetings, emergency broadcasts, departmental calendar,
-- expenses, feature flags, feedback

-- ==================== PASSWORD RESET ====================

CREATE TYPE reset_channel AS ENUM ('email', 'sms');

CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel reset_channel NOT NULL DEFAULT 'email',
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_resets_user ON password_resets(user_id);
CREATE INDEX idx_password_resets_expires ON password_resets(expires_at);

-- ==================== ACCOUNT LOCKOUT ====================

CREATE TABLE account_lockouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_at TIMESTAMPTZ,
    unlock_at TIMESTAMPTZ,
    ip_addresses JSONB DEFAULT '[]',
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lockouts_user ON account_lockouts(user_id);
CREATE INDEX idx_lockouts_locked ON account_lockouts(is_locked) WHERE is_locked = true;

-- ==================== ACTIVE SESSIONS ====================

CREATE TABLE active_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) NOT NULL,
    device_info TEXT,
    ip_address INET,
    user_agent TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX idx_active_sessions_expires ON active_sessions(expires_at);

-- ==================== GRADE APPEALS ====================

CREATE TYPE appeal_status AS ENUM ('submitted', 'lecturer_review', 'hod_review', 'resolved', 'rejected');

CREATE TABLE grade_appeals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    semester_id UUID NOT NULL REFERENCES semesters(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    reason TEXT NOT NULL,
    evidence_urls JSONB DEFAULT '[]',
    status appeal_status NOT NULL DEFAULT 'submitted',
    lecturer_response TEXT,
    lecturer_id UUID REFERENCES users(id),
    hod_response TEXT,
    hod_id UUID REFERENCES users(id),
    original_score FLOAT,
    revised_score FLOAT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grade_appeals_student ON grade_appeals(student_id);
CREATE INDEX idx_grade_appeals_course ON grade_appeals(course_id);
CREATE INDEX idx_grade_appeals_status ON grade_appeals(status);

-- ==================== STUDY PLANNER / TASKS ====================

CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

CREATE TABLE study_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority task_priority NOT NULL DEFAULT 'medium',
    status task_status NOT NULL DEFAULT 'pending',
    due_date TIMESTAMPTZ,
    reminder_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    is_smart_suggestion BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_tasks_user ON study_tasks(user_id);
CREATE INDEX idx_study_tasks_due ON study_tasks(due_date);
CREATE INDEX idx_study_tasks_status ON study_tasks(status);

-- ==================== CLASS NOTICE BOARD ====================

CREATE TABLE class_notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_rep_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    pinned_order INT,
    allow_comments BOOLEAN DEFAULT true,
    attachment_url TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_class_notices_pinned ON class_notices(is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_class_notices_created ON class_notices(created_at);

CREATE TABLE class_notice_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notice_id UUID NOT NULL REFERENCES class_notices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notice_comments_notice ON class_notice_comments(notice_id);

-- ==================== STAFF MEETINGS ====================

CREATE TYPE meeting_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

CREATE TABLE staff_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    meeting_date TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    venue VARCHAR(255),
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50),
    status meeting_status NOT NULL DEFAULT 'scheduled',
    minutes_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_meetings_date ON staff_meetings(meeting_date);
CREATE INDEX idx_staff_meetings_status ON staff_meetings(status);

CREATE TABLE meeting_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES staff_meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    responded BOOLEAN DEFAULT false,
    attending BOOLEAN,
    responded_at TIMESTAMPTZ,
    UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_meeting_attendees_meeting ON meeting_attendees(meeting_id);

-- ==================== EMERGENCY BROADCASTS ====================

CREATE TYPE broadcast_priority AS ENUM ('normal', 'urgent', 'critical');

CREATE TABLE emergency_broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority broadcast_priority NOT NULL DEFAULT 'urgent',
    template VARCHAR(100),
    channels JSONB DEFAULT '["push", "email"]',
    target_roles JSONB DEFAULT '["student", "lecturer", "class_rep"]',
    requires_acknowledgment BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_broadcasts_sender ON emergency_broadcasts(sender_id);
CREATE INDEX idx_broadcasts_priority ON emergency_broadcasts(priority);

CREATE TABLE broadcast_acknowledgments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcast_id UUID NOT NULL REFERENCES emergency_broadcasts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(broadcast_id, user_id)
);

CREATE INDEX idx_broadcast_acks_broadcast ON broadcast_acknowledgments(broadcast_id);

-- ==================== DEPARTMENTAL CALENDAR ====================

CREATE TYPE calendar_event_type AS ENUM ('exam', 'deadline', 'meeting', 'holiday', 'event', 'custom');

CREATE TABLE departmental_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type calendar_event_type NOT NULL DEFAULT 'custom',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    venue VARCHAR(255),
    target_levels JSONB DEFAULT '[]',
    target_audience JSONB DEFAULT '["student"]',
    is_all_day BOOLEAN DEFAULT false,
    color VARCHAR(20) DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dept_events_date ON departmental_events(start_time);
CREATE INDEX idx_dept_events_type ON departmental_events(event_type);

-- ==================== EXPENSES ====================

CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    expense_date DATE NOT NULL,
    receipt_url TEXT,
    status expense_status NOT NULL DEFAULT 'pending',
    submitted_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

CREATE TABLE expense_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(100) NOT NULL UNIQUE,
    session_id UUID REFERENCES sessions(id),
    budget_amount NUMERIC(10,2) NOT NULL,
    spent_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    alert_threshold FLOAT DEFAULT 0.8,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== FEATURE FLAGS ====================

CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    target_roles JSONB DEFAULT '[]',
    target_levels JSONB DEFAULT '[]',
    percentage FLOAT DEFAULT 100.0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_name ON feature_flags(name);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(is_enabled);

-- ==================== IN-APP FEEDBACK ====================

CREATE TYPE feedback_type AS ENUM ('bug', 'feature', 'general');
CREATE TYPE feedback_status AS ENUM ('submitted', 'under_review', 'planned', 'implemented', 'declined');

CREATE TABLE feedback_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    feedback_type feedback_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    rating INT,
    screenshot_url TEXT,
    device_info JSONB DEFAULT '{}',
    status feedback_status NOT NULL DEFAULT 'submitted',
    admin_response TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_user ON feedback_submissions(user_id);
CREATE INDEX idx_feedback_status ON feedback_submissions(status);
CREATE INDEX idx_feedback_type ON feedback_submissions(feedback_type);

-- ==================== HELP CENTER / FAQ ====================

CREATE TABLE help_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    view_count INT DEFAULT 0,
    helpful_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_help_articles_category ON help_articles(category);
CREATE INDEX idx_help_articles_published ON help_articles(is_published);

-- ==================== GPA CALCULATOR SCENARIOS ====================

CREATE TABLE gpa_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'My Scenario',
    courses JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gpa_scenarios_user ON gpa_scenarios(user_id);

-- ==================== TRIGGERS ====================

CREATE TRIGGER update_account_lockouts_updated_at BEFORE UPDATE ON account_lockouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_tasks_updated_at BEFORE UPDATE ON study_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_notices_updated_at BEFORE UPDATE ON class_notices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grade_appeals_updated_at BEFORE UPDATE ON grade_appeals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_budgets_updated_at BEFORE UPDATE ON expense_budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gpa_scenarios_updated_at BEFORE UPDATE ON gpa_scenarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_help_articles_updated_at BEFORE UPDATE ON help_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
