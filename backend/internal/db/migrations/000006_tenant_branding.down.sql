-- 000006_tenant_branding.down.sql
--
-- Reverses 000006 by removing every department's description and logo.

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_logo_type_pair;
ALTER TABLE tenants DROP COLUMN IF EXISTS logo_type;
ALTER TABLE tenants DROP COLUMN IF EXISTS logo;
ALTER TABLE tenants DROP COLUMN IF EXISTS description;
