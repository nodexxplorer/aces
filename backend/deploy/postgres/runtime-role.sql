-- runtime-role.sql
--
-- Creates or updates the restricted database role that the API (and
-- cmd/seed_admin) connect as, and grants it what it needs.
--
-- Why a separate role: row-level security (RLS) is what keeps one department's
-- rows away from another's. RLS does not apply to superusers, to roles with
-- BYPASSRLS, or to the owner of a table. The API must therefore never connect
-- as any of those. The server checks this at startup and refuses to run
-- otherwise. See docs/multi-tenancy.md.
--
-- Run it as the migration owner, after the migrations, and again after any
-- migration that adds tables or sequences (new objects need the grants below):
--
--   psql "$OWNER_DB_SOURCE" -v ON_ERROR_STOP=1 \
--        -v app_role=aces_app -v app_password="$APP_DB_PASSWORD" \
--        -f deploy/postgres/runtime-role.sql
--
-- The owner needs CREATEROLE (or superuser) to create the role. The script is
-- idempotent: running it again only re-applies the same settings.

-- The role that runs this script is the owner. The runtime role must differ from
-- it, because the ALTER ROLE below strips superuser from the role it targets.
SELECT set_config('aces.app_role', :'app_role', false) \gset

DO $$
BEGIN
    IF current_setting('aces.app_role') = current_user THEN
        RAISE EXCEPTION 'app_role must be a different role from the migration owner (%)', current_user;
    END IF;
END
$$;

-- Create the role on first run.
SELECT format('CREATE ROLE %I', :'app_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

-- On every run: keep the role free of anything that bypasses RLS, and keep its
-- password in step with APP_DB_PASSWORD.
ALTER ROLE :"app_role" WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT PASSWORD :'app_password';

-- Connect to this database and use its schema.
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_role') \gexec
GRANT USAGE ON SCHEMA public TO :"app_role";

-- Data access. Which rows the role can see is decided by row-level security.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_role";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"app_role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO :"app_role";

-- The department registry is changed with cmd/tenant, never by the API.
REVOKE INSERT, UPDATE, DELETE ON TABLE tenants FROM :"app_role";

-- Migration history belongs to the migration tool.
SELECT format('REVOKE ALL ON TABLE schema_migrations FROM %I', :'app_role')
WHERE to_regclass('public.schema_migrations') IS NOT NULL
\gexec
