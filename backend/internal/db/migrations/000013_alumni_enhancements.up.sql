-- Alumni Enhancement Migration
-- Adds mentorship sessions, audit logs, job post enhancements, event enhancements, donation stats

-- ==================== MENTORSHIP SESSIONS ====================

CREATE TABLE mentorship_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentorship_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'video', -- 'video', 'chat', 'in_person'
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'no_show'
    notes TEXT,
    mentor_confirmed BOOLEAN NOT NULL DEFAULT false,
    mentee_confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mentorship_sessions_mentorship ON mentorship_sessions(mentorship_id);
CREATE INDEX idx_mentorship_sessions_status ON mentorship_sessions(status);

-- ==================== ALUMNI AUDIT LOG ====================

CREATE TABLE alumni_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumni_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- 'graduated', 'profile_updated', 'job_posted', 'mentorship_started', 'donation_made', 'event_created', 'connected'
    actor_id UUID NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alumni_audit_alumni ON alumni_audit_logs(alumni_id);
CREATE INDEX idx_alumni_audit_action ON alumni_audit_logs(action);
CREATE INDEX idx_alumni_audit_created ON alumni_audit_logs(created_at);

-- ==================== JOB POST ENHANCEMENTS ====================

ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS responsibilities TEXT;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS target_levels JSONB DEFAULT '[]';
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS target_departments JSONB DEFAULT '[]';
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS application_method VARCHAR(20) DEFAULT 'aces_zone';
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS applications_count INTEGER DEFAULT 0;

-- ==================== EVENT ENHANCEMENTS ====================

ALTER TABLE alumni_events ADD COLUMN IF NOT EXISTS target_audience VARCHAR(20) DEFAULT 'both'; -- 'students', 'alumni', 'both'
ALTER TABLE alumni_events ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'; -- 'draft', 'pending_approval', 'approved', 'completed', 'cancelled'
ALTER TABLE alumni_events ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE alumni_events ADD COLUMN IF NOT EXISTS rsvp_count INTEGER DEFAULT 0;
ALTER TABLE alumni_events ADD COLUMN IF NOT EXISTS attendance_count INTEGER DEFAULT 0;

-- ==================== ALUMNI STATUS ENHANCEMENTS ====================

ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS matric_number VARCHAR(50);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS cgpa_at_graduation NUMERIC(4,2);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS job_title VARCHAR(100);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- ==================== DONATION COUNTERS ====================

ALTER TABLE alumni_donations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger for alumni_donations updated_at
CREATE TRIGGER update_alumni_donations_updated_at BEFORE UPDATE ON alumni_donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
