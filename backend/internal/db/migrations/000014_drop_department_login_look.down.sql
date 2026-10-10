-- 000014_drop_department_login_look.down.sql
--
-- Restores the table as 000013 created it (the data is not restored).
CREATE TABLE department_login_looks (
    tenant_id UUID PRIMARY KEY DEFAULT app_current_tenant() REFERENCES tenants(id),
    template VARCHAR(16) NOT NULL DEFAULT 'classic'
        CHECK (template IN ('classic', 'split', 'centered')),
    hero BYTEA CHECK (hero IS NULL OR octet_length(hero) <= 4194304),
    hero_type VARCHAR(32)
        CHECK (hero_type IS NULL OR hero_type IN ('image/png', 'image/jpeg', 'image/webp')),
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT department_login_looks_hero_pair CHECK ((hero IS NULL) = (hero_type IS NULL))
);

ALTER TABLE department_login_looks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON department_login_looks
    USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
