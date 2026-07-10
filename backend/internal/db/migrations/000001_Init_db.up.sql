-- 001_init.sql
-- Transcript Zone Database Schema
-- PostgreSQL 16+

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== ENUMS ====================

CREATE TYPE user_role AS ENUM (
    'hod',
    'admin', 
    'lecturer',
    'class_rep',
    'student',
    'bursar_dept',
    'bursar_class'
);

CREATE TYPE semester_season AS ENUM ('harmattan', 'rain');

CREATE TYPE academic_standing AS ENUM (
    'good_standing',
    'probation', 
    'suspension'
);

CREATE TYPE result_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);

CREATE TYPE grade AS ENUM (
    'A', -- 70-100
    'B', -- 60-69
    'C', -- 50-59
    'D', -- 45-49
    'E', -- 40-44
    'F'  -- 0-39
);

CREATE TYPE complaint_category AS ENUM (
    'result_error',
    'payment_issue',
    'profile_issue',
    'attendance_dispute',
    'assignment_issue',
    'other'
);

CREATE TYPE complaint_status AS ENUM (
    'open',
    'in_review',
    'resolved',
    'rejected'
);

CREATE TYPE complaint_priority AS ENUM (
    'low',
    'medium',
    'high'
);

CREATE TYPE payment_type AS ENUM (
    'dept_dues',
    'class_dues',
    'manual',
    'materials',
    'transcript_fee',
    'other'
);

CREATE TYPE payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);

CREATE TYPE transcript_status AS ENUM (
    'requested',
    'pending_payment',
    'processing',
    'ready',
    'sent'
);

CREATE TYPE notification_type AS ENUM (
    'result_published',
    'payment_due',
    'complaint_resolved',
    'assignment_graded',
    'deadline_reminder',
    'exam_conflict',
    'profile_approved',
    'announcement',
    'general'
);

CREATE TYPE backup_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed'
);

-- ==================== CORE TABLES ====================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by_hod_id UUID REFERENCES users(id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- ==================== ACADEMIC TABLES ====================
-- Sessions and semesters must be created before students (FK dependency)

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(20) NOT NULL UNIQUE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_name ON sessions(name);
CREATE INDEX idx_sessions_active ON sessions(is_active);

CREATE TABLE semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name semester_season NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    registration_deadline TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_semesters_session ON semesters(session_id);

-- ==================== CORE TABLES (continued) ====================

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    matric_number VARCHAR(50) NOT NULL UNIQUE,
    level INTEGER NOT NULL DEFAULT 100,
    entry_year INTEGER NOT NULL,
    current_session_id UUID REFERENCES sessions(id),
    current_semester semester_season DEFAULT 'harmattan',
    cgpa DECIMAL(3,2) DEFAULT 0.00,
    total_credits_earned INTEGER DEFAULT 0,
    total_credits_required INTEGER DEFAULT 120,
    academic_standing academic_standing DEFAULT 'good_standing',
    graduation_status VARCHAR(50) DEFAULT 'in_progress',
    is_defaulter BOOLEAN NOT NULL DEFAULT false,
    defaulter_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_matric ON students(matric_number);
CREATE INDEX idx_students_level ON students(level);
CREATE INDEX idx_students_session ON students(current_session_id);

CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    staff_id VARCHAR(50) NOT NULL UNIQUE,
    department VARCHAR(255) NOT NULL,
    rank VARCHAR(100),
    specialization TEXT,
    employment_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_staff_id ON staff(staff_id);

CREATE TABLE admin_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    can_manage_results BOOLEAN NOT NULL DEFAULT false,
    can_manage_users BOOLEAN NOT NULL DEFAULT false,
    can_manage_finance BOOLEAN NOT NULL DEFAULT false,
    can_manage_courses BOOLEAN NOT NULL DEFAULT false,
    can_view_analytics BOOLEAN NOT NULL DEFAULT false,
    can_manage_announcements BOOLEAN NOT NULL DEFAULT false,
    can_backup_data BOOLEAN NOT NULL DEFAULT false,
    granted_by_hod_id UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_admin_permissions_user ON admin_permissions(user_id);
CREATE INDEX idx_admin_permissions_granted_by ON admin_permissions(granted_by_hod_id);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    unit INTEGER NOT NULL,
    level INTEGER NOT NULL,
    semester semester_season NOT NULL,
    lecturer_id UUID REFERENCES users(id),
    prerequisite_id UUID REFERENCES courses(id),
    max_credit_hours INTEGER DEFAULT 24,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_code ON courses(code);
CREATE INDEX idx_courses_level ON courses(level);
CREATE INDEX idx_courses_semester ON courses(semester);
CREATE INDEX idx_courses_lecturer ON courses(lecturer_id);

CREATE TABLE course_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id),
    semester_id UUID NOT NULL REFERENCES semesters(id),
    total_units INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_registrations_student ON course_registrations(student_id);
CREATE INDEX idx_course_registrations_session ON course_registrations(session_id);
CREATE INDEX idx_course_registrations_semester ON course_registrations(semester_id);

CREATE TABLE registered_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES course_registrations(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id),
    status VARCHAR(50) NOT NULL DEFAULT 'enrolled',
    is_carryover BOOLEAN NOT NULL DEFAULT false,
    previous_attempt_id UUID REFERENCES registered_courses(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registered_courses_registration ON registered_courses(registration_id);
CREATE INDEX idx_registered_courses_course ON registered_courses(course_id);

-- ==================== RESULTS TABLES ====================

CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id),
    ca_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    exam_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    grade grade,
    grade_point DECIMAL(3,2),
    session_id UUID NOT NULL REFERENCES sessions(id),
    semester_id UUID NOT NULL REFERENCES semesters(id),
    status result_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    is_carryover BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_results_student ON results(student_id);
CREATE INDEX idx_results_course ON results(course_id);
CREATE INDEX idx_results_session ON results(session_id);
CREATE INDEX idx_results_status ON results(status);

CREATE TABLE result_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
    field_changed VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    edited_by UUID NOT NULL REFERENCES users(id),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_result ON result_audit_logs(result_id);
CREATE INDEX idx_audit_logs_edited_by ON result_audit_logs(edited_by);
CREATE INDEX idx_audit_logs_created_at ON result_audit_logs(created_at);

CREATE TABLE carryover_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id),
    original_result_id UUID NOT NULL REFERENCES results(id),
    original_session_id UUID NOT NULL REFERENCES sessions(id),
    attempt_count INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_result_id UUID REFERENCES results(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carryover_student ON carryover_courses(student_id);
CREATE INDEX idx_carryover_course ON carryover_courses(course_id);

-- ==================== ASSIGNMENT TABLES ====================

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline TIMESTAMPTZ NOT NULL,
    max_score INTEGER NOT NULL DEFAULT 20,
    allowed_formats JSONB DEFAULT '["pdf", "docx"]',
    file_url TEXT,
    uploaded_by_class_rep_id UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    semester_id UUID NOT NULL REFERENCES semesters(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignments_course ON assignments(course_id);
CREATE INDEX idx_assignments_session ON assignments(session_id);

CREATE TABLE assignment_grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    score DECIMAL(5,2),
    feedback TEXT,
    is_late BOOLEAN NOT NULL DEFAULT false,
    graded_by UUID NOT NULL REFERENCES users(id),
    graded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignment_grades_assignment ON assignment_grades(assignment_id);
CREATE INDEX idx_assignment_grades_student ON assignment_grades(student_id);

-- ==================== ATTENDANCE TABLES ====================

CREATE TABLE attendance_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id),
    date TIMESTAMPTZ NOT NULL,
    class_rep_id UUID NOT NULL REFERENCES users(id),
    attendance_data JSONB NOT NULL DEFAULT '[]',
    pdf_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    finalized_at TIMESTAMPTZ,
    emailed_to_lecturer BOOLEAN NOT NULL DEFAULT false,
    session_id UUID NOT NULL REFERENCES sessions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_course ON attendance_sheets(course_id);
CREATE INDEX idx_attendance_date ON attendance_sheets(date);
CREATE INDEX idx_attendance_class_rep ON attendance_sheets(class_rep_id);

-- ==================== PAYMENT TABLES ====================

CREATE TABLE dues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type payment_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    level INTEGER,
    session_id UUID REFERENCES sessions(id),
    semester_id UUID REFERENCES semesters(id),
    deadline TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dues_type ON dues(type);
CREATE INDEX idx_dues_level ON dues(level);

CREATE TABLE payment_cart (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    due_id UUID NOT NULL REFERENCES dues(id),
    amount DECIMAL(10,2) NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cart_student ON payment_cart(student_id);

CREATE TABLE payment_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    paystack_reference VARCHAR(255),
    status payment_status NOT NULL DEFAULT 'pending',
    receipt_url TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_student ON payment_batches(student_id);
CREATE INDEX idx_batches_status ON payment_batches(status);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES payment_batches(id),
    due_id UUID NOT NULL REFERENCES dues(id),
    type payment_type NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paystack_reference VARCHAR(255),
    status payment_status NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_batch ON payments(batch_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ==================== COMPLAINT TABLES ====================

CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    category complaint_category NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    priority complaint_priority NOT NULL DEFAULT 'medium',
    status complaint_status NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES users(id),
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_complaints_student ON complaints(student_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_assigned ON complaints(assigned_to);
CREATE INDEX idx_complaints_created ON complaints(created_at);

-- ==================== TRANSCRIPT TABLES ====================

CREATE TABLE transcript_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    purpose VARCHAR(255) NOT NULL,
    status transcript_status NOT NULL DEFAULT 'requested',
    fee_paid BOOLEAN NOT NULL DEFAULT false,
    fee_amount DECIMAL(10,2) DEFAULT 0.00,
    pdf_url TEXT,
    qr_code_url TEXT,
    sent_via_email BOOLEAN NOT NULL DEFAULT false,
    emailed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcripts_student ON transcript_requests(student_id);
CREATE INDEX idx_transcripts_status ON transcript_requests(status);

-- ==================== TIMETABLE TABLES ====================

CREATE TABLE timetable (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id),
    exam_date TIMESTAMPTZ NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    venue VARCHAR(255) NOT NULL,
    session_id UUID NOT NULL REFERENCES sessions(id),
    semester_id UUID NOT NULL REFERENCES semesters(id),
    has_conflict BOOLEAN NOT NULL DEFAULT false,
    conflict_details JSONB,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timetable_course ON timetable(course_id);
CREATE INDEX idx_timetable_date ON timetable(exam_date);
CREATE INDEX idx_timetable_session ON timetable(session_id);

-- ==================== COMMUNICATION TABLES ====================

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    target_level INTEGER,
    target_audience JSONB DEFAULT '[]',
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_pinned ON announcements(is_pinned);
CREATE INDEX idx_announcements_level ON announcements(target_level);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT,
    email_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ==================== SYSTEM TABLES ====================

CREATE TABLE backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    s3_url TEXT NOT NULL,
    size_mb DECIMAL(10,2),
    status backup_status NOT NULL DEFAULT 'pending',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backups_status ON backups(status);

CREATE TABLE profile_update_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profile_requests_student ON profile_update_requests(student_id);
CREATE INDEX idx_profile_requests_status ON profile_update_requests(status);

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON complaints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
