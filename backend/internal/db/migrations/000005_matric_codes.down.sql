-- 000005_matric_codes.down.sql
--
-- Reverses 000005 by removing every department's matric code. Matric numbers
-- already stored on students are not touched. Without codes the server refuses
-- matric-based sign-up and onboarding, so roll back only with the previous
-- release running.

DROP INDEX IF EXISTS tenants_matric_code_key;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_matric_code_format;
ALTER TABLE tenants DROP COLUMN IF EXISTS matric_code;
