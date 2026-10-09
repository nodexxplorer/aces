-- The department's accent colour, as #rrggbb. It is computed from the logo when
-- the logo is set (cmd/tenant update -logo, cmd/tenant logos), and cleared when
-- the logo is removed. NULL means no accent: the department uses the platform
-- colour. The API passes it to clients; nothing on the server depends on it.
ALTER TABLE tenants ADD COLUMN accent_color VARCHAR(7);
ALTER TABLE tenants ADD CONSTRAINT tenants_accent_color_format
    CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-f]{6}$');
