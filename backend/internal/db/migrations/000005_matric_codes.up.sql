-- 000005_matric_codes.up.sql
--
-- Matric codes: the part of a matric number that names the department, so
-- that a student's matric number can be checked against the department they
-- sign in to.
--
-- A matric number has the form 20/EG/CO/1234: the entry year, the faculty
-- (EG), the department (CO) and a serial number. A department's matric_code is
-- the faculty and department part, stored as EG/CO. The server builds the
-- pattern from it at run time, so no department is hard-coded.
--
-- A department with no matric_code (NULL) cannot check matric numbers, so the
-- server refuses sign-up and onboarding for it until a code is set. This is
-- deliberate: the check fails closed.
--
-- The tenants table is the global registry (no row-level security), so this is
-- a plain column. The runtime role already has SELECT on it, and only the owner
-- (cmd/tenant) writes it.

ALTER TABLE tenants ADD COLUMN matric_code VARCHAR(5);

ALTER TABLE tenants ADD CONSTRAINT tenants_matric_code_format
    CHECK (matric_code IS NULL OR matric_code ~ '^[A-Z]{2}/[A-Z]{2}$');

-- Two departments must never share a code, or a matric number could not be
-- traced to one department. NULLs do not collide, so departments without a
-- code can coexist.
CREATE UNIQUE INDEX tenants_matric_code_key ON tenants (matric_code);

-- The legacy department (Computer Engineering) keeps the format it has always
-- used, so its students are checked exactly as before.
UPDATE tenants
SET matric_code = 'EG/CO'
WHERE id = '00000000-0000-4000-8000-000000000001' AND matric_code IS NULL;
