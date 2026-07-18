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
