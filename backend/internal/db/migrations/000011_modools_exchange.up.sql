-- One-time codes for the mobile Modools sign-in. The browser ends a mobile
-- sign-in with a code, not a session. The app trades the code for its session at
-- POST /api/v1/auth/modools/exchange, and proves it started the sign-in with the
-- PKCE verifier whose challenge the code is bound to. A code is stored only as
-- its SHA-256 hash, works once, and expires 60 seconds after it is issued.
CREATE TABLE modools_exchange_codes (
    code_hash      BYTEA       PRIMARY KEY CHECK (octet_length(code_hash) = 32),
    tenant_id      UUID        NOT NULL REFERENCES tenants (id),
    user_id        UUID        NOT NULL,
    code_challenge VARCHAR(43) NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
    expires_at     TIMESTAMPTZ NOT NULL,
    used_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX modools_exchange_codes_expires_at_idx ON modools_exchange_codes (expires_at);

-- Row-level security, as for every tenant-owned table (see 000004). A code is
-- visible only to the department it was issued in.
ALTER TABLE modools_exchange_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON modools_exchange_codes
    USING (tenant_id = app_current_tenant())
    WITH CHECK (tenant_id = app_current_tenant());
