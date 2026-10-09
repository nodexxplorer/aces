-- The address the approval page sends students to, when it is not the address
-- on the dues receipts. Optional: a department without one gets its contact
-- email on the approval page instead.
ALTER TABLE tenants ADD COLUMN approval_email VARCHAR(254);
ALTER TABLE tenants ADD CONSTRAINT tenants_approval_email_format
    CHECK (approval_email IS NULL OR approval_email ~ '^[^@[:space:]]+@[^@[:space:].][^@[:space:]]*\.[^@[:space:].]+$');

-- The legacy department's approval requests have gone to this HOD address since
-- before the column existed. The receipts keep contact_email.
UPDATE tenants SET approval_email = 'hod@computer.engineering.uniuyo.edu.ng'
WHERE id = '00000000-0000-4000-8000-000000000001' AND approval_email IS NULL;
