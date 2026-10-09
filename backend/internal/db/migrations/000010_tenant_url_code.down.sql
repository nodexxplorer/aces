ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_url_code_key;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_url_code_format;
ALTER TABLE tenants DROP COLUMN IF EXISTS url_code;
