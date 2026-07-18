-- 000007_delegate_student_roles.up.sql
-- Extends multi-role system: new role enum values + role assignment audit logs

-- ==================== NEW ROLE ENUM VALUES ====================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'project_coordinator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'event_coordinator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'alumni_rep';

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
