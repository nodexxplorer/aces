ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_approval_email_format;
ALTER TABLE tenants DROP COLUMN IF EXISTS approval_email;
