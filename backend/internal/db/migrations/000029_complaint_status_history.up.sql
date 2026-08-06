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
