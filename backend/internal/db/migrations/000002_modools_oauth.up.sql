-- Modools OAuth login for students. The account is keyed by Modools' stable
-- `sub` claim (email can change on the IdP side; sub shouldn't). The stored
-- refresh token is only for logout revocation (offline_access scope) — ACES
-- Zone issues its own JWT session pair after the handshake, Modools tokens
-- are never used to authenticate requests.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS modools_sub VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS modools_refresh_token TEXT;

-- OAuth-created students have no matric number yet; onboarding sets it.
-- Existing rows are untouched (NOT NULL semantics preserved for them by
-- having no NULLs to begin with).
ALTER TABLE students
    ALTER COLUMN matric_number DROP NOT NULL;

-- The entry year can be derived from the matric prefix (e.g. 20/... -> 2020)
-- at onboarding; keep it nullable until then too.
ALTER TABLE students
    ALTER COLUMN entry_year DROP NOT NULL;
