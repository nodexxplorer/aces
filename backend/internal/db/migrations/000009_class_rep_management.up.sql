-- Class Representative Management System
-- Supports elections, direct appointments, attendance marking, reports, and performance reviews

-- Tracks which user is the class rep for which class/year group
CREATE TABLE class_rep_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL,        -- e.g. '2025/2026'
    appointment_type VARCHAR(20) NOT NULL CHECK (appointment_type IN ('election', 'direct')),
    appointed_by UUID REFERENCES users(id),    -- HOD who appointed directly
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    consecutive_terms INT NOT NULL DEFAULT 1,  -- how many consecutive terms this rep has served
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_class_rep_assignments_rep ON class_rep_assignments(class_rep_id);
CREATE INDEX idx_class_rep_assignments_level ON class_rep_assignments(level, academic_year);

-- Election records
CREATE TABLE class_rep_elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),  -- HOD who created
    status VARCHAR(20) NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'nominating', 'voting', 'completed', 'cancelled')),
    nomination_start TIMESTAMPTZ,
    nomination_end TIMESTAMPTZ,
    voting_start TIMESTAMPTZ,
    voting_end TIMESTAMPTZ,
    winner_id UUID REFERENCES users(id),
    total_votes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_class_rep_elections_level ON class_rep_elections(level, academic_year);

-- Nominees for each election
CREATE TABLE election_nominees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES class_rep_elections(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manifesto TEXT,
    nominated_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(election_id, student_id)
);

CREATE INDEX idx_election_nominees_election ON election_nominees(election_id);

-- Votes cast in an election
CREATE TABLE election_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES class_rep_elections(id) ON DELETE CASCADE,
    nominee_id UUID NOT NULL REFERENCES election_nominees(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(election_id, voter_id)  -- one vote per student per election
);

CREATE INDEX idx_election_votes_election ON election_votes(election_id);

-- Reports from class reps to HOD
CREATE TABLE class_rep_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(30) NOT NULL CHECK (report_type IN ('attendance_issue', 'student_welfare', 'class_feedback', 'incident', 'general')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    level INT,
    academic_year VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'resolved', 'archived')),
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_class_rep_reports_rep ON class_rep_reports(class_rep_id);
CREATE INDEX idx_class_rep_reports_status ON class_rep_reports(status);

-- Attendance marking methods enum support
CREATE TABLE attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    class_rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id),
    semester_id UUID REFERENCES semesters(id),
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (method IN ('qr', 'manual', 'geofence', 'digital_sheet')),
    venue VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'finalized')),
    started_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    total_present INT NOT NULL DEFAULT 0,
    total_absent INT NOT NULL DEFAULT 0,
    total_students INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_sessions_rep ON attendance_sessions(class_rep_id);
CREATE INDEX idx_attendance_sessions_course ON attendance_sessions(course_id, date);

-- Individual check-ins for attendance sessions
CREATE TABLE attendance_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (method IN ('qr', 'manual', 'digital_sheet')),
    present BOOLEAN NOT NULL DEFAULT true,
    remark TEXT,
    UNIQUE(session_id, student_id)
);

CREATE INDEX idx_attendance_checkins_session ON attendance_checkins(session_id);

-- Class representative performance reviews (by HOD)
CREATE TABLE class_rep_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_by UUID NOT NULL REFERENCES users(id),
    academic_year VARCHAR(20) NOT NULL,
    term VARCHAR(20) NOT NULL,             -- 'harmattan' or 'rain'
    attendance_rate DECIMAL(5,2),           -- percentage
    reports_submitted INT NOT NULL DEFAULT 0,
    responsiveness_score INT CHECK (responsiveness_score >= 1 AND responsiveness_score <= 5),
    comments TEXT,
    rating VARCHAR(20) CHECK (rating IN ('excellent', 'good', 'satisfactory', 'needs_improvement', 'poor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_class_rep_performance_rep ON class_rep_performance(class_rep_id);
