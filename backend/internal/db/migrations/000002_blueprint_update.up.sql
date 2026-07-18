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
