-- Migration 000010: Lecturer Management + Bursar Dashboard Enhancement
-- Extends staff table, adds lecturer assignment tracking, leave, evaluations,
-- and adds payment_method column for manual payment recording.

-- ==================== EXTEND STAFF TABLE ====================
ALTER TABLE staff ADD COLUMN IF NOT EXISTS title VARCHAR(50);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'full_time';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS qualifications JSONB DEFAULT '[]';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS office_location VARCHAR(255);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS office_hours JSONB DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS publications JSONB DEFAULT '[]';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS date_joined DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ==================== LECTURER COURSE ASSIGNMENTS ====================
CREATE TABLE lecturer_course_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    semester VARCHAR(20) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    assigned_by UUID NOT NULL REFERENCES users(id),
    reassigned_from UUID REFERENCES lecturer_course_assignments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, session_id, semester)
);

CREATE INDEX idx_lca_lecturer ON lecturer_course_assignments(lecturer_id);
CREATE INDEX idx_lca_course ON lecturer_course_assignments(course_id);
CREATE INDEX idx_lca_session ON lecturer_course_assignments(session_id);

-- ==================== LECTURER LEAVE ====================
CREATE TYPE leave_type AS ENUM ('sabbatical', 'study', 'sick', 'maternity', 'paternity', 'conference', 'personal');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'active', 'completed', 'rejected', 'cancelled');

CREATE TABLE lecturer_leave (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    course_handover JSONB DEFAULT '{}',
    status leave_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ll_lecturer ON lecturer_leave(lecturer_id);
CREATE INDEX idx_ll_status ON lecturer_leave(status);

-- ==================== LECTURER EVALUATIONS ====================
CREATE TABLE lecturer_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    student_anon_id UUID NOT NULL,
    clarity SMALLINT CHECK (clarity BETWEEN 1 AND 5),
    punctuality SMALLINT CHECK (punctuality BETWEEN 1 AND 5),
    availability SMALLINT CHECK (availability BETWEEN 1 AND 5),
    fairness SMALLINT CHECK (fairness BETWEEN 1 AND 5),
    technology SMALLINT CHECK (technology BETWEEN 1 AND 5),
    overall SMALLINT CHECK (overall BETWEEN 1 AND 5),
    comments TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_le_lecturer ON lecturer_evaluations(lecturer_id);
CREATE INDEX idx_le_course ON lecturer_evaluations(course_id);
CREATE INDEX idx_le_session ON lecturer_evaluations(session_id);

-- ==================== LECTURER PERFORMANCE ====================
CREATE TABLE lecturer_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id),
    student_eval_score DECIMAL(5,2),
    hod_assessment_score DECIMAL(5,2),
    peer_review_score DECIMAL(5,2),
    research_output_score DECIMAL(5,2),
    overall_score DECIMAL(5,2),
    hod_comments TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lp_lecturer ON lecturer_performance(lecturer_id);

-- ==================== PAYMENT METHOD COLUMN ====================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'paystack';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
