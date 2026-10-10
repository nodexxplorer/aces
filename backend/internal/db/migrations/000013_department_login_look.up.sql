-- 000013_department_login_look.up.sql
--
-- The sign-in and sign-up look for each department: which of the three
-- templates it uses, and the hero image an admin uploaded for that template.
--
-- It is a tenant table with row-level security, not a column on the registry.
-- The registry (tenants) is written only by cmd/tenant, because the runtime role
-- cannot change it, and an admin uploading an image in the app must not need
-- that. Each department has at most one row; no row means the classic look and
-- no image.
--
-- The image is limited to 4 MiB and three raster types, like the logo. SVG is
-- not allowed, because an uploaded SVG can run script when opened.

CREATE TABLE department_login_looks (
    tenant_id UUID PRIMARY KEY DEFAULT app_current_tenant() REFERENCES tenants(id),
    template VARCHAR(16) NOT NULL DEFAULT 'classic'
        CHECK (template IN ('classic', 'split', 'centered')),
    hero BYTEA CHECK (hero IS NULL OR octet_length(hero) <= 4194304),
    hero_type VARCHAR(32)
        CHECK (hero_type IS NULL OR hero_type IN ('image/png', 'image/jpeg', 'image/webp')),
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- The bytes and their type are set and cleared together.
    CONSTRAINT department_login_looks_hero_pair CHECK ((hero IS NULL) = (hero_type IS NULL))
);

ALTER TABLE department_login_looks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON department_login_looks
    USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
