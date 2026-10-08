-- 000006_tenant_branding.up.sql
--
-- Department branding: a short description and a logo per department. The
-- sign-in and sign-up pages and the dashboard (navbar, sidebar and footer) show
-- them, so a department's name, description and logo come from its registry
-- record instead of being hard-coded.
--
-- The logo is stored in the registry row, which is global (no row-level
-- security), and is served by GET /api/v1/tenants/:slug/logo. It is public on
-- purpose: the sign-in page shows it before anyone has signed in. Only
-- cmd/tenant writes these columns, since the runtime role cannot change the
-- registry.
--
-- The logo is small and limited to three image types. SVG is not allowed,
-- because an uploaded SVG can run script when opened.

ALTER TABLE tenants ADD COLUMN description TEXT
    CHECK (description IS NULL OR char_length(description) <= 500);

ALTER TABLE tenants ADD COLUMN logo BYTEA
    CHECK (logo IS NULL OR octet_length(logo) <= 262144);

ALTER TABLE tenants ADD COLUMN logo_type VARCHAR(32)
    CHECK (logo_type IS NULL OR logo_type IN ('image/png', 'image/jpeg', 'image/webp'));

-- The bytes and their type are set and cleared together.
ALTER TABLE tenants ADD CONSTRAINT tenants_logo_type_pair
    CHECK ((logo IS NULL) = (logo_type IS NULL));
