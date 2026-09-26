-- 000001_squash_baseline.up.sql
-- Full database schema, squashed from migrations 000001..000051 (original
-- order preserved; enum ADD VALUEs folded into their CREATE TYPEs; 000018
-- was a no-op). This file is the only migration a fresh database needs.
-- Supabase note: pgcrypto/uuid-ossp already live in the 'extensions'
-- schema, so CREATE EXTENSION IF NOT EXISTS is a harmless no-op there.

-- ==================== 000001_Init_db.up.sql ====================
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
    'bursar_class',
    'project_coordinator',
    'event_coordinator',
    'alumni_rep'
);

CREATE TYPE semester_season AS ENUM (
    'harmattan',
    'rain',
    'first',
    'second'
);

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

-- ==================== 000002_blueprint_update.up.sql ====================
-- Add approval columns to users
ALTER TABLE users ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN approved_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN approved_at TIMESTAMPTZ;

-- Add onboarding/admission columns to students
ALTER TABLE students ADD COLUMN admission_mode VARCHAR(20);
ALTER TABLE students ADD COLUMN year_admitted INTEGER;
ALTER TABLE students ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Add course_type column to courses
ALTER TABLE courses ADD COLUMN course_type VARCHAR(20) NOT NULL DEFAULT 'departmental';

-- Create signup_approvals table
CREATE TABLE signup_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signup_type VARCHAR(20) NOT NULL, -- 'student', 'class_rep', 'lecturer'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reg_no VARCHAR(50),
    level INTEGER,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create cgpa_rules table
CREATE TABLE cgpa_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    min_score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) NOT NULL,
    grade VARCHAR(2) NOT NULL,
    grade_point DECIMAL(3,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create academic_standing_rules table
CREATE TABLE academic_standing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    min_cgpa DECIMAL(3,2) NOT NULL,
    max_cgpa DECIMAL(3,2) NOT NULL,
    standing VARCHAR(50) NOT NULL, -- 'good_standing', 'probation', 'suspension'
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Mark existing users as approved
UPDATE users SET is_approved = true;

-- Seed default CGPA Rules
INSERT INTO cgpa_rules (min_score, max_score, grade, grade_point) VALUES
(70.00, 100.00, 'A', 5.00),
(60.00, 69.99, 'B', 4.00),
(50.00, 59.99, 'C', 3.00),
(45.00, 49.99, 'D', 2.00),
(40.00, 44.99, 'E', 1.00),
(0.00, 39.99, 'F', 0.00);

-- Seed default Academic Standing Rules
INSERT INTO academic_standing_rules (min_cgpa, max_cgpa, standing) VALUES
(1.50, 5.00, 'good_standing'),
(1.00, 1.49, 'probation'),
(0.00, 0.99, 'suspension');

-- ==================== 000003_blueprint_v5_tables.up.sql ====================
-- 000003_blueprint_v5_tables.up.sql
-- Adds all missing tables from ACES Zone Blueprint v5.1
-- Multi-role, manuals, campus connect, skills/trade, alumni

-- ==================== ENUMS ====================

CREATE TYPE connection_status AS ENUM ('pending', 'accepted', 'rejected', 'blocked');
CREATE TYPE trade_status AS ENUM ('pending', 'accepted', 'completed', 'cancelled');
CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE mentorship_status AS ENUM ('pending', 'accepted', 'active', 'completed', 'declined');
CREATE TYPE job_type AS ENUM ('full_time', 'part_time', 'internship', 'contract', 'remote');
CREATE TYPE application_status AS ENUM ('pending', 'reviewed', 'shortlisted', 'accepted', 'rejected');
CREATE TYPE alumni_verification_status AS ENUM ('pending', 'verified', 'rejected');

-- ==================== MULTI-ROLE TABLES ====================

CREATE TABLE user_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX idx_user_role_assignments_role ON user_role_assignments(role);

CREATE TABLE role_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_role user_role,
    to_role user_role NOT NULL,
    promoted_by UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_role_promotions_user ON role_promotions(user_id);
CREATE INDEX idx_role_promotions_promoted_by ON role_promotions(promoted_by);

CREATE TABLE bursar_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    bursar_type VARCHAR(20) NOT NULL, -- 'class' or 'dept'
    session_id UUID REFERENCES sessions(id),
    assigned_by UUID NOT NULL REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    UNIQUE(user_id, level, bursar_type)
);

CREATE INDEX idx_bursar_assignments_user ON bursar_assignments(user_id);
CREATE INDEX idx_bursar_assignments_level ON bursar_assignments(level);

-- ==================== COURSE SUBCATEGORIES ====================

CREATE TABLE course_subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- 'theory', 'practical', 'theory_practical'
    weight_percentage INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, name)
);

CREATE INDEX idx_course_subcategories_course ON course_subcategories(course_id);

-- ==================== MANUALS & PRACTICAL ENROLLMENT ====================

CREATE TABLE manuals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    file_url TEXT,
    cover_image_url TEXT,
    course_id UUID REFERENCES courses(id),
    session_id UUID REFERENCES sessions(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_manuals_level ON manuals(level);
CREATE INDEX idx_manuals_course ON manuals(course_id);

CREATE TABLE manual_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    manual_id UUID NOT NULL REFERENCES manuals(id),
    payment_id UUID REFERENCES payments(id),
    qr_code_data TEXT,
    qr_code_url TEXT,
    is_collected BOOLEAN NOT NULL DEFAULT false,
    collected_at TIMESTAMPTZ,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, manual_id)
);

CREATE INDEX idx_manual_purchases_student ON manual_purchases(student_id);
CREATE INDEX idx_manual_purchases_manual ON manual_purchases(manual_id);

CREATE TABLE manual_print_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES manual_purchases(id),
    student_id UUID NOT NULL REFERENCES students(id),
    manual_id UUID NOT NULL REFERENCES manuals(id),
    status VARCHAR(20) NOT NULL DEFAULT 'queued', -- 'queued', 'printing', 'ready', 'collected'
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    printed_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ,
    processed_by UUID REFERENCES users(id)
);

CREATE INDEX idx_print_queue_status ON manual_print_queue(status);
CREATE INDEX idx_print_queue_student ON manual_print_queue(student_id);

CREATE TABLE practical_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id),
    manual_purchase_id UUID REFERENCES manual_purchases(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    enrolled_via VARCHAR(20) NOT NULL DEFAULT 'qr_scan', -- 'qr_scan', 'manual', 'admin'
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, course_id, session_id)
);

CREATE INDEX idx_practical_enrollments_student ON practical_enrollments(student_id);
CREATE INDEX idx_practical_enrollments_course ON practical_enrollments(course_id);

-- ==================== CAMPUS CONNECT ====================

CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status connection_status NOT NULL DEFAULT 'pending',
    message TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(requester_id, receiver_id),
    CHECK (requester_id != receiver_id)
);

CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_receiver ON connections(receiver_id);
CREATE INDEX idx_connections_status ON connections(status);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(created_at);

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'study', -- 'study', 'project', 'interest', 'class'
    avatar_url TEXT,
    max_members INTEGER DEFAULT 100,
    is_private BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_category ON groups(category);
CREATE INDEX idx_groups_created_by ON groups(created_by);

CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'admin', 'moderator', 'member'
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

CREATE TABLE group_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_messages_group ON group_messages(group_id);
CREATE INDEX idx_group_messages_created ON group_messages(created_at);

-- ==================== SKILLS & TRADE ====================

CREATE TABLE skill_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skill_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES skill_categories(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    skill_level skill_level NOT NULL DEFAULT 'intermediate',
    price DECIMAL(10,2),
    is_free BOOLEAN NOT NULL DEFAULT false,
    barter_available BOOLEAN NOT NULL DEFAULT false,
    barter_description TEXT,
    portfolio_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_listings_user ON skill_listings(user_id);
CREATE INDEX idx_skill_listings_category ON skill_listings(category_id);
CREATE INDEX idx_skill_listings_level ON skill_listings(skill_level);

CREATE TABLE trade_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offered_skill_id UUID NOT NULL REFERENCES skill_listings(id),
    requested_skill_id UUID REFERENCES skill_listings(id),
    status trade_status NOT NULL DEFAULT 'pending',
    message TEXT,
    price_offered DECIMAL(10,2),
    is_barter BOOLEAN NOT NULL DEFAULT false,
    responded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (from_user_id != to_user_id)
);

CREATE INDEX idx_trade_offers_from ON trade_offers(from_user_id);
CREATE INDEX idx_trade_offers_to ON trade_offers(to_user_id);
CREATE INDEX idx_trade_offers_status ON trade_offers(status);

CREATE TABLE skill_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trade_offers(id),
    rater_id UUID NOT NULL REFERENCES users(id),
    rated_user_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(trade_id, rater_id)
);

CREATE INDEX idx_skill_ratings_rated_user ON skill_ratings(rated_user_id);
CREATE INDEX idx_skill_ratings_trade ON skill_ratings(trade_id);

CREATE TABLE user_reputation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_ratings INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    total_trades_completed INTEGER NOT NULL DEFAULT 0,
    reputation_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_reputation_score ON user_reputation(reputation_score DESC);

-- ==================== ALUMNI SYSTEM ====================

CREATE TABLE alumni_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    graduation_year INTEGER NOT NULL,
    graduation_class VARCHAR(50),
    verification_status alumni_verification_status NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    is_mentor_available BOOLEAN NOT NULL DEFAULT false,
    mentor_specialization TEXT,
    current_company VARCHAR(255),
    current_position VARCHAR(255),
    linkedin_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alumni_status_user ON alumni_status(user_id);
CREATE INDEX idx_alumni_status_year ON alumni_status(graduation_year);
CREATE INDEX idx_alumni_status_verification ON alumni_status(verification_status);
CREATE INDEX idx_alumni_status_mentor ON alumni_status(is_mentor_available) WHERE is_mentor_available = true;

CREATE TABLE mentorship_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status mentorship_status NOT NULL DEFAULT 'pending',
    topic VARCHAR(255) NOT NULL,
    message TEXT,
    responded_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (student_id != mentor_id)
);

CREATE INDEX idx_mentorship_student ON mentorship_requests(student_id);
CREATE INDEX idx_mentorship_mentor ON mentorship_requests(mentor_id);
CREATE INDEX idx_mentorship_status ON mentorship_requests(status);

CREATE TABLE job_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    job_type job_type NOT NULL DEFAULT 'full_time',
    description TEXT NOT NULL,
    requirements TEXT,
    salary_range VARCHAR(100),
    application_url TEXT,
    application_deadline TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_posts_posted_by ON job_posts(posted_by);
CREATE INDEX idx_job_posts_type ON job_posts(job_type);
CREATE INDEX idx_job_posts_active ON job_posts(is_active) WHERE is_active = true;

CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status application_status NOT NULL DEFAULT 'pending',
    cover_letter TEXT,
    resume_url TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(job_id, applicant_id)
);

CREATE INDEX idx_job_applications_job ON job_applications(job_id);
CREATE INDEX idx_job_applications_applicant ON job_applications(applicant_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);

CREATE TABLE alumni_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL DEFAULT 'networking', -- 'reunion', 'workshop', 'networking', 'seminar', 'career_fair'
    location VARCHAR(255),
    is_virtual BOOLEAN NOT NULL DEFAULT false,
    virtual_link TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    max_attendees INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alumni_events_type ON alumni_events(event_type);
CREATE INDEX idx_alumni_events_date ON alumni_events(start_date);

CREATE TABLE event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES alumni_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rsvp_status VARCHAR(20) NOT NULL DEFAULT 'registered', -- 'registered', 'confirmed', 'attended', 'cancelled'
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX idx_event_attendees_user ON event_attendees(user_id);

-- ==================== TRIGGERS ====================

CREATE TRIGGER update_manuals_updated_at BEFORE UPDATE ON manuals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skill_listings_updated_at BEFORE UPDATE ON skill_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alumni_status_updated_at BEFORE UPDATE ON alumni_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_posts_updated_at BEFORE UPDATE ON job_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== 000004_add_user_profile_fields.up.sql ====================
-- Add personal profile fields to users table for onboarding and admin editing
ALTER TABLE users ADD COLUMN date_of_birth DATE;
ALTER TABLE users ADD COLUMN emergency_contact_name VARCHAR(255);
ALTER TABLE users ADD COLUMN emergency_contact_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN home_address TEXT;

-- ==================== 000005_add_timetable_fields.up.sql ====================
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS day_of_week INTEGER;
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS level INTEGER;
ALTER TABLE timetable ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE timetable ALTER COLUMN semester_id DROP NOT NULL;
ALTER TABLE timetable ALTER COLUMN created_by DROP NOT NULL;

-- ==================== 000006_enhance_timetable.up.sql ====================
-- Migration 000006: Enhance timetable for class + exam types with conflict detection and publish workflow

-- Entry type: 'class' for weekly lecture schedule, 'exam' for exam schedule
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS entry_type VARCHAR(10) NOT NULL DEFAULT 'class';

-- Class-specific fields
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS class_type VARCHAR(20); -- lecture, lab, tutorial, seminar
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS lecturer_id UUID REFERENCES users(id);

-- Exam-specific fields
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS exam_type VARCHAR(20); -- main, carryover
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS invigilators TEXT;

-- Publish workflow
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_timetable_entry_type ON timetable(entry_type);

-- ==================== 000007_delegate_student_roles.up.sql ====================
-- 000007_delegate_student_roles.up.sql
-- Extends multi-role system: new role enum values + role assignment audit logs

-- (new user_role values folded directly into the CREATE TYPE above)





-- ==================== ROLE ASSIGNMENT AUDIT LOG ====================

CREATE TABLE role_assignment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('assigned', 'removed')),
    performed_by UUID NOT NULL REFERENCES users(id),
    performed_by_role VARCHAR(50),
    previous_roles JSONB DEFAULT '[]'::jsonb,
    new_roles JSONB DEFAULT '[]'::jsonb,
    reason TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_role_assignment_logs_user ON role_assignment_logs(user_id);
CREATE INDEX idx_role_assignment_logs_performed_by ON role_assignment_logs(performed_by);
CREATE INDEX idx_role_assignment_logs_created ON role_assignment_logs(created_at DESC);

-- ==================== 000008_student_profile_editing.up.sql ====================
CREATE TYPE document_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE document_type AS ENUM ('profile_photo', 'id_card', 'transcript', 'certificate', 'admission_letter', 'supporting_doc', 'medical_report');
CREATE TYPE change_request_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'appealed', 'closed');
CREATE TYPE profile_change_type AS ENUM ('self_edit', 'hod_edit', 'hod_approved', 'bulk_edit', 'system_corrected');

CREATE TABLE profile_edit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID NOT NULL REFERENCES users(id),
    changed_by_role VARCHAR(50) NOT NULL,
    change_type profile_change_type NOT NULL,
    reason TEXT,
    ip_address VARCHAR(50),
    request_id UUID REFERENCES profile_update_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profile_edit_logs_student ON profile_edit_logs(student_id);
CREATE INDEX idx_profile_edit_logs_changed_by ON profile_edit_logs(changed_by);
CREATE INDEX idx_profile_edit_logs_request ON profile_edit_logs(request_id);

CREATE TABLE student_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    doc_type document_type NOT NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    status document_status NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_documents_student ON student_documents(student_id);
CREATE INDEX idx_student_documents_type ON student_documents(doc_type);
CREATE INDEX idx_student_documents_status ON student_documents(status);

-- ==================== 000009_class_rep_management.up.sql ====================
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

-- ==================== 000010_lecturer_management.up.sql ====================
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

-- ==================== 000011_subcategories_analytics_backup.up.sql ====================
-- ============================================================
-- Universal subcategories table (replaces course-specific only)
-- ============================================================
CREATE TYPE subcategory_module AS ENUM (
    'courses', 'dues', 'skills', 'events', 'announcements', 'jobs', 'groups'
);

CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module subcategory_module NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6366f1',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subcategories_module ON subcategories(module);
CREATE INDEX idx_subcategories_active ON subcategories(is_active);

-- ============================================================
-- Subcategory assignments (links subcategories to entities)
-- ============================================================
CREATE TABLE subcategory_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory_id UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(subcategory_id, entity_type, entity_id)
);
CREATE INDEX idx_subcategory_assignments_entity ON subcategory_assignments(entity_type, entity_id);

-- ============================================================
-- Analytics snapshots (periodic snapshots for trends)
-- ============================================================
CREATE TABLE analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimension JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_analytics_snapshots_date_metric ON analytics_snapshots(snapshot_date, metric_name);
CREATE INDEX idx_analytics_snapshots_name ON analytics_snapshots(metric_name);

-- ============================================================
-- Reports table (generated report metadata)
-- ============================================================
CREATE TYPE report_status AS ENUM (
    'generating',
    'completed',
    'failed',
    'pending',
    'reviewed',
    'resolved',
    'dismissed'
);

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'pdf',
    file_url TEXT,
    status report_status NOT NULL DEFAULT 'generating',
    generated_by UUID REFERENCES users(id),
    parameters JSONB DEFAULT '{}',
    row_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_status ON reports(status);

-- ============================================================
-- Scheduled reports
-- ============================================================
CREATE TYPE scheduled_frequency AS ENUM ('daily', 'weekly', 'monthly', 'semester');

CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'pdf',
    frequency scheduled_frequency NOT NULL,
    recipients JSONB NOT NULL DEFAULT '[]',
    parameters JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scheduled_reports_active ON scheduled_reports(is_active);

-- ==================== 000012_alumni_donations.up.sql ====================
-- Alumni Donations
CREATE TYPE donation_channel AS ENUM ('general', 'scholarship', 'project', 'event_sponsorship', 'emergency');
CREATE TYPE donation_tier AS ENUM ('none', 'bronze', 'silver', 'gold', 'platinum');

CREATE TABLE alumni_donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID NOT NULL REFERENCES users(id),
    channel donation_channel NOT NULL DEFAULT 'general',
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 1000),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    payment_id UUID,
    receipt_url TEXT,
    message TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    recognized_tier donation_tier NOT NULL DEFAULT 'none',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alumni_donations_donor ON alumni_donations(donor_id);
CREATE INDEX idx_alumni_donations_channel ON alumni_donations(channel);
CREATE INDEX idx_alumni_donations_status ON alumni_donations(status);

-- Alumni status extensions
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS mentorship_topics JSONB DEFAULT '[]';
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS willing_to_speak BOOLEAN DEFAULT false;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS event_interests JSONB DEFAULT '[]';
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS privacy_level VARCHAR(20) DEFAULT 'public';
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS donation_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS mentorship_sessions_count INT DEFAULT 0;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS jobs_posted_count INT DEFAULT 0;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS events_attended_count INT DEFAULT 0;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- ==================== 000013_alumni_enhancements.up.sql ====================
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

-- ==================== 000014_ai_integration.up.sql ====================
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

-- ==================== 000015_additional_features.up.sql ====================
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

-- ==================== 000016_campus_connect_v2.up.sql ====================
-- Campus Connect V2: Feed, Reactions, Profiles, Moderation, Files

-- ==================== CAMPUS PROFILES ====================

CREATE TABLE campus_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    interests JSONB DEFAULT '[]',
    skills JSONB DEFAULT '[]',
    availability_status VARCHAR(20) NOT NULL DEFAULT 'offline',
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    connection_count INT NOT NULL DEFAULT 0,
    post_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campus_profiles_user ON campus_profiles(user_id);
CREATE INDEX idx_campus_profiles_availability ON campus_profiles(availability_status);

-- ==================== FEED POSTS ====================

DO $$ BEGIN
    CREATE TYPE feed_post_type AS ENUM ('text', 'photo', 'announcement', 'event', 'job', 'achievement', 'milestone', 'group_share');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE feed_audience AS ENUM ('public', 'connections', 'group', 'department');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE feed_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_type feed_post_type NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    media_urls JSONB DEFAULT '[]',
    target_audience feed_audience NOT NULL DEFAULT 'public',
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    like_count INT NOT NULL DEFAULT 0,
    comment_count INT NOT NULL DEFAULT 0,
    share_count INT NOT NULL DEFAULT 0,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_posts_author ON feed_posts(author_id);
CREATE INDEX idx_feed_posts_created ON feed_posts(created_at DESC);
CREATE INDEX idx_feed_posts_group ON feed_posts(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_feed_posts_audience ON feed_posts(target_audience);
CREATE INDEX idx_feed_posts_type ON feed_posts(post_type);

-- ==================== POST COMMENTS ====================

CREATE TABLE post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_post_comments_author ON post_comments(author_id);
CREATE INDEX idx_post_comments_parent ON post_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;

-- ==================== POST REACTIONS ====================

DO $$ BEGIN
    CREATE TYPE reaction_type AS ENUM ('like', 'love', 'celebrate', 'insightful', 'funny');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE post_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type reaction_type NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX idx_post_reactions_user ON post_reactions(user_id);

-- ==================== COMMENT REACTIONS ====================

CREATE TABLE comment_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type reaction_type NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);

-- ==================== MESSAGE REACTIONS ====================

CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type reaction_type NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);

-- ==================== GROUP FILE SHARING ====================

CREATE TABLE group_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_files_group ON group_files(group_id);

-- ==================== CONNECTION STRIKES ====================

CREATE TABLE connection_strikes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    strike_number INT NOT NULL DEFAULT 1,
    issued_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_connection_strikes_user ON connection_strikes(user_id);

-- ==================== CAMPUS REPORTS ====================

DO $$ BEGIN
    CREATE TYPE report_target_type AS ENUM ('post', 'comment', 'message', 'user', 'group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE campus_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type report_target_type NOT NULL,
    target_id UUID NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    action_taken TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_campus_reports_status ON campus_reports(status);
CREATE INDEX idx_campus_reports_target ON campus_reports(target_type, target_id);

-- ==================== POST BOOKMARKS ====================

CREATE TABLE post_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

CREATE INDEX idx_post_bookmarks_user ON post_bookmarks(user_id);

-- ==================== TRIGGERS ====================

CREATE TRIGGER update_campus_profiles_updated_at BEFORE UPDATE ON campus_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_posts_updated_at BEFORE UPDATE ON feed_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== 000017_verification_announcements.up.sql ====================
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

-- ==================== 000018_seed_skill_categories.up.sql ====================
-- (skill categories feature was removed; seed was a historical no-op)

-- ==================== 000019_donation_paystack_reference.up.sql ====================
ALTER TABLE alumni_donations ADD COLUMN paystack_reference VARCHAR(100);
CREATE INDEX idx_alumni_donations_paystack_ref ON alumni_donations(paystack_reference);

UPDATE alumni_donations SET status = 'completed' WHERE status = 'completed';

-- ==================== 000020_results_matric_number.up.sql ====================
-- Make student_id nullable and add matric_number for deferred student linkage
ALTER TABLE results ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE results ADD COLUMN matric_number TEXT;

-- Create index for fast matric_number lookups during auto-linking
CREATE INDEX idx_results_matric_number ON results(matric_number) WHERE matric_number IS NOT NULL;

-- Create function to auto-link results to students by matric_number
CREATE OR REPLACE FUNCTION link_pending_results()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE results
    SET student_id = NEW.id
    WHERE matric_number = NEW.matric_number
      AND student_id IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: when a student row is inserted, link any pending results
CREATE TRIGGER trg_link_pending_results
    AFTER INSERT ON students
    FOR EACH ROW
    EXECUTE FUNCTION link_pending_results();

-- ==================== 000021_user_middle_name.up.sql ====================
-- Add middle_name column to users table
ALTER TABLE users ADD COLUMN middle_name TEXT;

-- Populate middle_name from full_name where possible
-- full_name currently stores "FirstName LastName", so we can't auto-populate middle_name
-- It will be set during onboarding

-- ==================== 000022_notifications_system.up.sql ====================
-- Enhance notifications table with category, priority, targeting, and metadata
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'general';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_label VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_category ON notifications(user_id, category);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    email_auth BOOLEAN DEFAULT true,
    email_results BOOLEAN DEFAULT true,
    email_dues BOOLEAN DEFAULT true,
    email_messages BOOLEAN DEFAULT true,
    email_connect BOOLEAN DEFAULT false,
    email_skills BOOLEAN DEFAULT false,
    email_alumni BOOLEAN DEFAULT true,
    email_system BOOLEAN DEFAULT true,
    push_auth BOOLEAN DEFAULT true,
    push_results BOOLEAN DEFAULT true,
    push_dues BOOLEAN DEFAULT true,
    push_messages BOOLEAN DEFAULT true,
    push_connect BOOLEAN DEFAULT true,
    push_skills BOOLEAN DEFAULT true,
    push_alumni BOOLEAN DEFAULT true,
    push_system BOOLEAN DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ==================== 000023_split_full_name.up.sql ====================
-- Add first_name and last_name columns
ALTER TABLE users ADD COLUMN first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN last_name VARCHAR(255);

-- Split existing full_name into first_name and last_name
-- last_name = last word, first_name = everything before it
UPDATE users SET
    last_name  = TRIM(SPLIT_PART(full_name, ' ', GREATEST(1, LENGTH(full_name) - LENGTH(REPLACE(full_name, ' ', ''))))),
    first_name = TRIM(REPLACE(full_name, SPLIT_PART(full_name, ' ', GREATEST(1, LENGTH(full_name) - LENGTH(REPLACE(full_name, ' ', '')))), ''));

-- Handle single-word names (no space): put everything in first_name
UPDATE users SET first_name = full_name, last_name = '' WHERE last_name IS NULL OR TRIM(last_name) = '';

-- Make columns NOT NULL with defaults
ALTER TABLE users ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_name SET DEFAULT '';
ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;

-- Drop old full_name column, recreate as stored generated column
ALTER TABLE users DROP COLUMN full_name;
ALTER TABLE users ADD COLUMN full_name VARCHAR(255) GENERATED ALWAYS AS (
  CASE
    WHEN middle_name IS NULL OR middle_name = '' THEN TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    ELSE TRIM(COALESCE(first_name, '') || ' ' || COALESCE(middle_name, '') || ' ' || COALESCE(last_name, ''))
  END
) STORED;

-- ==================== 000024_add_campus_report_status_values.up.sql ====================
-- Add missing values to the existing report_status enum that migration 16 intended to have
-- Migration 11 created report_status with ('generating', 'completed', 'failed')
-- Migration 16 tried to add ('pending', 'reviewed', 'resolved', 'dismissed') but silently failed

-- ==================== 000025_security_fixes.up.sql ====================
-- Migration 000025: Security Fixes
-- Adds index for lecturer-course assignment lookup used by result entry authorization.

CREATE INDEX IF NOT EXISTS idx_lecturer_course_assignments_lookup
    ON lecturer_course_assignments (lecturer_id, course_id);

-- ==================== 000026_drop_skills_and_broadcasts.up.sql ====================
-- Drop unused Skills & Trade marketplace tables
DROP TABLE IF EXISTS trade_offers CASCADE;
DROP TABLE IF EXISTS skill_ratings CASCADE;
DROP TABLE IF EXISTS skill_listings CASCADE;
DROP TABLE IF EXISTS skill_categories CASCADE;

-- Drop unused Emergency Broadcasts tables and enum
DROP TABLE IF EXISTS broadcast_acknowledgments CASCADE;
DROP TABLE IF EXISTS emergency_broadcasts CASCADE;
DROP TYPE IF EXISTS broadcast_priority CASCADE;

-- ==================== 000027_rename_semesters_to_first_second.up.sql ====================
-- (semester_season 'first'/'second' folded into the CREATE TYPE in 000001)

-- ==================== 000028_course_materials.up.sql ====================
-- Course Material Repository: lecturers upload slides/past questions/reading
-- materials per course; students (and staff) browse and download them.

CREATE TYPE course_material_type AS ENUM ('slide', 'past_question', 'reading', 'other');

CREATE TABLE course_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    session_id UUID REFERENCES sessions(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    material_type course_material_type NOT NULL DEFAULT 'other',
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    download_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_materials_course ON course_materials(course_id);
CREATE INDEX idx_course_materials_uploader ON course_materials(uploaded_by);

-- ==================== 000029_complaint_status_history.up.sql ====================
-- Complaint Escalation Tracking: a timeline of status transitions so
-- students can see where their complaint is in the resolution pipeline,
-- modeled on the existing profile_edit_logs audit-log pattern.

CREATE TABLE complaint_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    from_status complaint_status,
    to_status complaint_status NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    changed_by_role VARCHAR(50) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_complaint_status_history_complaint ON complaint_status_history(complaint_id);

-- ==================== 000030_course_requirement_type.up.sql ====================
-- Core vs Elective classification for courses — independent of the
-- existing departmental/non-departmental course_type (which governs
-- cross-department registration eligibility, not whether a course is
-- mandatory for the student's programme).
ALTER TABLE courses ADD COLUMN requirement_type VARCHAR(20) NOT NULL DEFAULT 'core';

-- ==================== 000031_nullable_payment_due.up.sql ====================
-- payment_type already includes non-due categories (manual, materials,
-- transcript_fee, other), but due_id NOT NULL made it impossible to ever
-- insert one of those — there's no "due" behind a manual purchase.
ALTER TABLE payments ALTER COLUMN due_id DROP NOT NULL;

-- ==================== 000032_manual_purchase_printed_at.up.sql ====================
-- Decouples "cover was printed" from "manual was physically collected" —
-- previously bulk-printing a cover immediately marked is_collected, which
-- conflated the two. printed_at now tracks the print step; is_collected
-- (set only by a staff QR scan at handover) tracks actual pickup.
ALTER TABLE manual_purchases ADD COLUMN printed_at TIMESTAMPTZ;

-- ==================== 000033_notification_type_varchar.up.sql ====================
-- notifications.type was a narrow 9-value enum, but every feature added
-- since (payments, academic events, attendance, etc.) invented its own type
-- string assuming free text — exactly like category and priority on this
-- same table already are. Every one of those mismatched inserts was
-- silently failing (logged, never surfaced), so only login/general-category
-- notifications ever actually got created. Match the column to how it's
-- actually used instead of an enum that was never going to keep up.
ALTER TABLE notifications ALTER COLUMN type TYPE VARCHAR(50) USING type::text;

-- ==================== 000034_class_notice_targeting.up.sql ====================
ALTER TABLE class_notices ADD COLUMN level INT;
ALTER TABLE class_notices ADD COLUMN target_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX idx_class_notices_level ON class_notices(level);

-- ==================== 000035_attendance_status_review_states.up.sql ====================
-- attendance_sessions.status only allowed ('draft','open','closed','finalized'),
-- but submitAttendanceSession sets 'pending_lecturer_review' and
-- reviewAttendanceSession sets 'approved'/'changes_requested'/'rejected' —
-- every one of those UPDATEs silently violated the CHECK constraint, so a
-- class rep's "Send to Lecturer Dashboard" never actually changed the
-- session's status, and the lecturer's review queue (which filters on
-- status IN ('pending_lecturer_review','pending','submitted')) stayed
-- permanently empty no matter what class reps submitted.
ALTER TABLE attendance_sessions DROP CONSTRAINT attendance_sessions_status_check;
ALTER TABLE attendance_sessions ADD CONSTRAINT attendance_sessions_status_check
  CHECK (status IN (
    'draft', 'open', 'closed', 'finalized',
    'pending_lecturer_review', 'pending', 'submitted',
    'approved', 'changes_requested', 'rejected'
  ));

-- ==================== 000036_attendance_status_varchar_widen.up.sql ====================
-- 'pending_lecturer_review' is 24 characters — status VARCHAR(20) rejected
-- it with "value too long for type character varying(20)" on every submit,
-- the same silent-failure bug class as the CHECK constraint fixed in
-- migration 000035, just one layer deeper.
ALTER TABLE attendance_sessions ALTER COLUMN status TYPE VARCHAR(30);

-- ==================== 000037_calendar_feed_token.up.sql ====================
-- A per-user secret token embedded in their calendar subscription URL
-- (GET /calendar/feed/:token). Calendar clients (Google/Apple/Outlook)
-- fetch subscription URLs with no auth headers at all, so this token IS
-- the auth — generated lazily on first request, not at signup, and
-- regenerable to invalidate a leaked link.
ALTER TABLE users ADD COLUMN calendar_feed_token VARCHAR(64) UNIQUE;

-- ==================== 000038_birthday_greeting_tracking.up.sql ====================
-- Tracks the year a student was last sent their birthday greeting, so the
-- scheduler (which polls hourly, see internal/api/birthday.go) doesn't
-- re-send if it wakes up more than once on the same calendar day.
ALTER TABLE users ADD COLUMN last_birthday_greeted_year SMALLINT;

-- ==================== 000039_notification_unsubscribe_token.up.sql ====================
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64) UNIQUE;

-- ==================== 000040_crf_signing.up.sql ====================
-- Signature image + placement for each authorized signer, stamped onto
-- student-uploaded course registration forms. One row per kind — recalibrating
-- or re-uploading a signature upserts in place, since placement is the same
-- for every student (same official CRF template).
CREATE TABLE IF NOT EXISTS crf_signature_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(20) NOT NULL UNIQUE CHECK (kind IN ('hod', 'exam_officer')),
    file_path TEXT NOT NULL,
    page_number INT NOT NULL DEFAULT 1,
    x_pt NUMERIC NOT NULL,
    y_pt NUMERIC NOT NULL,
    width_pt NUMERIC NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A student's own signed CRF for a given semester — capped at one per
-- student per semester via the unique constraint below.
CREATE TABLE IF NOT EXISTS crf_signing_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id),
    original_file_path TEXT NOT NULL,
    signed_file_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_crf_signing_submissions_user ON crf_signing_submissions(user_id);

-- ==================== 000041_push_notifications.up.sql ====================
-- The device's Expo push token, letting the backend deliver real OS
-- notifications instead of only the in-app/WebSocket ones. Nullable — most
-- rows won't have one until that device registers (web users never will).
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ==================== 000042_crf_signature_max_height.up.sql ====================
-- Bounds the signature's rendered height, alongside the existing width_pt,
-- so a signature is scaled to fit inside its signing box on both
-- dimensions instead of only being width-constrained.
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS max_height_pt NUMERIC NOT NULL DEFAULT 0;

-- ==================== 000043_crf_signature_date.up.sql ====================
-- A live date stamp next to each signature (today's date at signing time,
-- not a fixed value), with its own adjustable placement and font size
-- independent of the signature image's position.
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS show_date BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS date_x_pt NUMERIC;
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS date_y_pt NUMERIC;
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS date_font_size NUMERIC NOT NULL DEFAULT 10;

-- ==================== 000044_web_push_subscription.up.sql ====================
-- The browser's PushSubscription object (endpoint + keys), JSON-serialized
-- as-is — this is the web equivalent of push_token for mobile, letting the
-- backend deliver a real OS/browser notification to a logged-in web session
-- via the Web Push protocol (VAPID), not just the in-app/WebSocket ones.
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS web_push_subscription TEXT;

-- ==================== 000045_remove_practicals_and_manuals.up.sql ====================
-- Removes the manuals/practicals feature. Full original schema is preserved
-- in docs/archived-features/practicals-and-manuals.md and recreated exactly
-- by this migration's .down.sql.
DROP TABLE IF EXISTS practical_enrollments;
DROP TABLE IF EXISTS manual_print_queue;
DROP TABLE IF EXISTS manual_purchases;
DROP TABLE IF EXISTS manuals;

-- ==================== 000046_crf_backlog.up.sql ====================
-- Configurable per-backlog fee, admin-editable. Singleton row (id fixed to 1).
CREATE TABLE crf_backlog_price (
    id INT PRIMARY KEY DEFAULT 1,
    amount_per_backlog NUMERIC(10,2) NOT NULL DEFAULT 1000,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crf_backlog_price_singleton CHECK (id = 1)
);

INSERT INTO crf_backlog_price (id, amount_per_backlog) VALUES (1, 1000);

-- A student's declared batch of old/unsigned course forms they want to
-- catch up on. total amount = requested_count * price-per-backlog at the
-- time of the request (snapshotted, so a later admin price change doesn't
-- retroactively change what's owed on an already-created request).
CREATE TABLE crf_backlog_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_count INT NOT NULL CHECK (requested_count > 0),
    amount NUMERIC(10,2) NOT NULL,
    payment_id UUID REFERENCES payments(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid')),
    forms_submitted INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX idx_crf_backlog_requests_user ON crf_backlog_requests(user_id);

-- ==================== 000047_group_invite_code.up.sql ====================
ALTER TABLE groups ADD COLUMN invite_code VARCHAR(12) UNIQUE;

-- ==================== 000048_seed_ccmas_courses.up.sql ====================
INSERT INTO courses (code, title, description, unit, level, semester, course_type, requirement_type) VALUES
-- 100L First Semester
('GST 111', 'Communication in English', NULL, 2, 100, 'first', 'non_departmental', 'core'),
('MTH 111', 'General Mathematics I', NULL, 2, 100, 'first', 'non_departmental', 'core'),
('PHY 111', 'General Physics I', NULL, 2, 100, 'first', 'non_departmental', 'core'),
('PHY 117', 'General Physics Practical I', NULL, 1, 100, 'first', 'non_departmental', 'core'),
('GET 111', 'Engineer in Society', NULL, 1, 100, 'first', 'non_departmental', 'core'),
('CPE 111', 'Introduction to Computer Engineering', 'Practical course', 2, 100, 'first', 'departmental', 'core'),
('CPE 113', 'Discrete Mathematics for Computing', NULL, 3, 100, 'first', 'departmental', 'core'),
('PHY 112', 'General Physics III', NULL, 2, 100, 'first', 'non_departmental', 'core'),
-- 100L Second Semester
('GST 121', 'Nigerian Peoples and Culture', NULL, 2, 100, 'second', 'non_departmental', 'core'),
('MTH 121', 'Elementary Mathematics II: Calculus', NULL, 2, 100, 'second', 'non_departmental', 'core'),
('PHY 121', 'General Physics II (Electricity and Magnetism)', NULL, 2, 100, 'second', 'non_departmental', 'core'),
('PHY 128', 'General Practical Physics II', NULL, 1, 100, 'second', 'non_departmental', 'core'),
('GET 122', 'Engineering Graphics and Solid Modelling', NULL, 2, 100, 'second', 'non_departmental', 'core'),
('MTH 122', 'General Mathematics III', NULL, 2, 100, 'second', 'non_departmental', 'core'),
('STA 121', 'Probability I', NULL, 3, 100, 'second', 'non_departmental', 'core'),
('CPE 122', 'Computer Programming I (Intro to C)', 'Practical course', 2, 100, 'second', 'departmental', 'core'),
-- 200L First Semester
('GST 211', 'Philosophy, Logic and Human Existence', NULL, 2, 200, 'first', 'non_departmental', 'core'),
('GET 211', 'Applied Electricity I', NULL, 3, 200, 'first', 'non_departmental', 'core'),
('GET 212', 'Fundamental of Fluid Mechanics', NULL, 3, 200, 'first', 'non_departmental', 'core'),
('GET 213', 'Engineering Mathematics I', NULL, 3, 200, 'first', 'non_departmental', 'core'),
('GET 214', 'Computing and Software Engineering', 'Practical course', 3, 200, 'first', 'non_departmental', 'core'),
('GET 215', 'Strength of Material', NULL, 3, 200, 'first', 'non_departmental', 'core'),
-- 200L Second Semester
('ENT 221', 'Entrepreneurship and Innovation', NULL, 2, 200, 'second', 'non_departmental', 'core'),
('GET 221', 'Engineering Materials', NULL, 3, 200, 'second', 'non_departmental', 'core'),
('GET 222', 'Engineering Workshop Practice', NULL, 2, 200, 'second', 'non_departmental', 'core'),
('GET 224', 'Engineering Mathematics II', NULL, 3, 200, 'second', 'non_departmental', 'core'),
('GET 225', 'Applied Mechanics', NULL, 3, 200, 'second', 'non_departmental', 'core'),
('GET 227', 'Engineering Graphics and Solid Modeling', NULL, 2, 200, 'second', 'non_departmental', 'core'),
('CPE 221', 'Computing and Software Engineering II', 'Practical course', 2, 200, 'second', 'departmental', 'core'),
-- 300L First Semester
('GST 311', 'Peace and Conflict Resolution', NULL, 2, 300, 'first', 'non_departmental', 'core'),
('GET 311', 'Engineering Mathematics III', NULL, 3, 300, 'first', 'non_departmental', 'core'),
('GET 312', 'Engineering Statistics and Data Analytics', NULL, 3, 300, 'first', 'non_departmental', 'core'),
('CPE 311', 'Computer Organization and Architecture', NULL, 2, 300, 'first', 'departmental', 'core'),
('CPE 312', 'Analogue Electronic Circuits', NULL, 2, 300, 'first', 'departmental', 'core'),
('CPE 313', 'Web Technology', 'Practical course', 2, 300, 'first', 'departmental', 'core'),
('CPE 314', 'Operating Systems', NULL, 2, 300, 'first', 'departmental', 'core'),
-- 300L Second Semester
('ENT 321', 'Venture Creation', NULL, 3, 300, 'second', 'non_departmental', 'core'),
('GET 321', 'Engineering Mathematics IV', NULL, 3, 300, 'second', 'non_departmental', 'core'),
('GET 322', 'Engineering, Communication, Technical Writing and Presentation', NULL, 3, 300, 'second', 'non_departmental', 'core'),
('GET 323', 'Renewable Energy Systems and Technologies', NULL, 3, 300, 'second', 'non_departmental', 'core'),
('GET 324', 'Introduction to Artificial Intelligence, Machine Learning', NULL, 2, 300, 'second', 'non_departmental', 'core'),
('CPE 321', 'Computer IT Hardware, Software & Operational Procedures', 'Practical course', 2, 300, 'second', 'departmental', 'core'),
('CPE 322', 'Digital Electronic Circuits', NULL, 2, 300, 'second', 'departmental', 'core'),
-- 400L First Semester
('GET 411', 'Engineering Project I', NULL, 2, 400, 'first', 'non_departmental', 'core'),
('GET 412', 'Engineering Evaluation and Costing', NULL, 2, 400, 'first', 'non_departmental', 'core'),
('CPE 411', 'Microprocessor and Embedded Systems', 'Practical course', 2, 400, 'first', 'departmental', 'core'),
('CPE 412', 'Control System (Robotics and Automation)', 'Practical course', 2, 400, 'first', 'departmental', 'core'),
('CPE 413', 'Fundamentals of Software Engineering', NULL, 2, 400, 'first', 'departmental', 'core'),
('CPE 414', 'Hardware Design Techniques and Verification', NULL, 2, 400, 'first', 'departmental', 'elective'),
('CPE 415', 'Database System Design and Applications', NULL, 2, 400, 'first', 'departmental', 'core'),
('CPE 416', 'Ubiquitous and Distributed Computing', NULL, 2, 400, 'first', 'departmental', 'core'),
('CPE 417', 'Assembly and Machine Language Programming', NULL, 2, 400, 'first', 'departmental', 'elective'),
('CPE 419', 'Neural Networks and Deep Learning', NULL, 2, 400, 'first', 'departmental', 'core'),
-- SIWES (200L/300L/400L second semester)
('GET 226', 'SIWES I', NULL, 3, 200, 'second', 'non_departmental', 'core'),
('GET 326', 'SIWES II', NULL, 4, 300, 'second', 'non_departmental', 'core'),
('GET 426', 'SIWES III', NULL, 6, 400, 'second', 'non_departmental', 'core'),
('GET 428', 'Engineering Valuation', NULL, 2, 400, 'second', 'non_departmental', 'core'),
-- 500L First Semester
('GET 511', 'Engineering Project Management', NULL, 3, 500, 'first', 'non_departmental', 'core'),
('GET 512', 'Engineering Law', NULL, 2, 500, 'first', 'non_departmental', 'core'),
('CPE 511', 'Data Communication and Networks', NULL, 2, 500, 'first', 'departmental', 'core'),
('CPE 512', 'Digital System Design with VHDL', 'Practical course', 2, 500, 'first', 'departmental', 'core'),
('CPE 513', 'Machine Learning and Applications', NULL, 2, 500, 'first', 'departmental', 'core'),
('CPE 514', 'Digital Forensics and Cyber Law', NULL, 2, 500, 'first', 'departmental', 'core'),
('CPE 515', 'Computer Vision and Robotics', NULL, 2, 500, 'first', 'departmental', 'core'),
('CPE 516', 'Human Computer Interaction', NULL, 2, 500, 'first', 'departmental', 'elective'),
('CPE 517', 'Mobile Application Development', NULL, 2, 500, 'first', 'departmental', 'elective'),
-- 500L Second Semester
('CPE 521', 'Digital Signal Processing', NULL, 2, 500, 'second', 'departmental', 'core'),
('CPE 522', 'Engineering Testing, Reliability and Maintainability', NULL, 2, 500, 'second', 'departmental', 'elective'),
('CPE 523', 'Digital Communication Network', NULL, 3, 500, 'second', 'departmental', 'core'),
('CPE 524', 'Technology, Strategy and Innovations', NULL, 2, 500, 'second', 'departmental', 'core'),
('CPE 525', 'Computer Security and Cryptography', NULL, 2, 500, 'second', 'departmental', 'core'),
('CPE 526', 'Software Project Management', NULL, 2, 500, 'second', 'departmental', 'elective'),
('CPE 529', 'Final Year Project', NULL, 6, 500, 'second', 'departmental', 'core')
ON CONFLICT (code) DO NOTHING;

-- ==================== 000049_crf_student_placement.up.sql ====================
-- Student-driven signature placement: the signing area differs between
-- versions of the course registration form, so the position can no longer be
-- a single admin-configured value. The admin now only uploads the signature
-- image per signer kind; the student drags/aligns it onto their own form
-- before approving. Drop the placement columns that were stamped server-side
-- from one global value.
ALTER TABLE crf_signature_assets
    DROP COLUMN IF EXISTS page_number,
    DROP COLUMN IF EXISTS x_pt,
    DROP COLUMN IF EXISTS y_pt,
    DROP COLUMN IF EXISTS width_pt,
    DROP COLUMN IF EXISTS max_height_pt,
    DROP COLUMN IF EXISTS show_date,
    DROP COLUMN IF EXISTS date_x_pt,
    DROP COLUMN IF EXISTS date_y_pt,
    DROP COLUMN IF EXISTS date_font_size;

-- What the student approved, one JSON object per signer kind, e.g.
--   {"hod": {"page":1,"x":120,"y":640,"width":110,"max_height":34,
--            "show_date":true,"date_x":120,"date_y":600,"date_font_size":10}}
-- Stored at approve time so the stamped PDF can be reproduced/audited.
ALTER TABLE crf_signing_submissions
    ADD COLUMN IF NOT EXISTS placements JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ==================== 000050_level_promotions.up.sql ====================
-- Session roll-over with HOD-confirmed batch promotion.
-- Levels are no longer derived from results (which are on hold); instead,
-- when a new session starts, the system proposes each student's outcome
-- (promote to level+100, or carryover) based on cycle completion
-- (dues paid + CRF signed or courses registered). HOD/admin reviews the
-- proposal per level, may flip individual students, then confirms the
-- batch — which atomically bumps levels and rolls students into the new
-- session.
CREATE TABLE level_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    from_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    to_session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    from_level INT NOT NULL,
    to_level INT NOT NULL,
    -- 'proposed' -> 'confirmed' | 'held_back' | 'carried_over'
    status VARCHAR(20) NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed', 'confirmed', 'held_back', 'carried_over')),
    -- How eligibility was determined, e.g. 'dues_crf', 'dues_registration',
    -- 'manual_advance', 'carryover'
    reason VARCHAR(30) NOT NULL DEFAULT 'carryover',
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One proposal per student per roll-over.
    UNIQUE (student_id, to_session_id)
);

CREATE INDEX idx_level_promotions_session ON level_promotions(to_session_id);
CREATE INDEX idx_level_promotions_status ON level_promotions(status);
CREATE INDEX idx_level_promotions_student ON level_promotions(student_id);

-- ==================== 000051_graduation_path.up.sql ====================
-- Graduation path for final-year (500 level) students: they are exempt from
-- the regular dues cycle and instead pay a one-off CRF signing fee. The fee
-- is admin-editable, singleton row (same pattern as crf_backlog_price).
CREATE TABLE graduation_fee (
    id INT PRIMARY KEY DEFAULT 1,
    amount NUMERIC(10,2) NOT NULL DEFAULT 1500,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT graduation_fee_singleton CHECK (id = 1)
);

INSERT INTO graduation_fee (id, amount) VALUES (1, 1500);

-- One graduation request per student (user_id UNIQUE). The fee is
-- snapshotted into amount_charged at request time so a later admin price
-- change doesn't retroactively change what an existing request owes.
-- Lifecycle: pending_payment -> paid (payment pipeline) -> cleared (staff).
-- waived = staff cleared the student without any fee being collected
-- (amount_charged is then 0).
CREATE TABLE graduation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    amount_charged NUMERIC(10,2) NOT NULL,
    payment_id UUID UNIQUE REFERENCES payments(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'cleared')),
    waived BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    cleared_by UUID REFERENCES users(id),
    cleared_at TIMESTAMPTZ
);

CREATE INDEX idx_graduation_requests_user ON graduation_requests(user_id);
