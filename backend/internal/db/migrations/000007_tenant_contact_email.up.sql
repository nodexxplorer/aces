-- A department's contact email, printed on its dues receipts. Optional: a
-- department without one gets a receipt without that line.
ALTER TABLE tenants ADD COLUMN contact_email VARCHAR(254);
ALTER TABLE tenants ADD CONSTRAINT tenants_contact_email_format
    CHECK (contact_email IS NULL OR contact_email ~ '^[^@[:space:]]+@[^@[:space:].][^@[:space:]]*\.[^@[:space:].]+$');

-- The legacy department keeps the contact line its receipts have always printed.
UPDATE tenants SET contact_email = 'acesuniuyo112@gmail.com'
WHERE id = '00000000-0000-4000-8000-000000000001' AND contact_email IS NULL;
