ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_contact_email_format;
ALTER TABLE tenants DROP COLUMN IF EXISTS contact_email;
