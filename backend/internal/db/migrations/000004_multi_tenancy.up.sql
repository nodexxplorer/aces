-- 000004_multi_tenancy.up.sql
--
-- Multi-tenancy: one tenant per department.
--
-- Isolation model: a single shared database. Every tenant-owned table carries
-- a tenant_id, and Postgres row-level security (RLS) enforces it on every
-- statement, including hand-written SQL. The backend binds each pooled
-- connection to exactly one tenant by setting the session variable
-- app.tenant_id (see internal/tenant). A connection with no tenant bound sees
-- no tenant rows and cannot insert any, so the default is fail-closed.
--
-- Operator notes:
--  * RLS is bypassed by superusers, roles with BYPASSRLS, and the owner of a
--    table. The runtime database role must have none of these. The backend
--    verifies this at startup (tenant.Manager.CheckRuntimeRole).
--  * Every pre-existing row is assigned to the default tenant below, so an
--    existing single-department deployment keeps working unchanged.
--  * INSERT statements need no changes: tenant_id defaults to the bound tenant.

-- ==================== TENANT REGISTRY ====================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(64) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255),
    faculty VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The department that owns all data that existed before multi-tenancy.
INSERT INTO tenants (id, slug, name, institution, faculty)
VALUES ('00000000-0000-4000-8000-000000000001', 'uniuyo-ce',
        'Department of Computer Engineering', 'University of Uyo', 'Faculty of Engineering');

-- The tenant bound to the current session. NULL (fail closed) when none is bound.
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS UUID
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;

-- The column is added as plain DDL (not inside a PL/pgSQL loop) so that schema
-- tools that read the migrations, such as sqlc, see every tenant_id. Existing rows
-- take the default tenant; the default is changed to the bound tenant below.

ALTER TABLE academic_standing_rules ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE account_lockouts ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE active_sessions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE admin_permissions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE ai_interactions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE ai_predictions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE ai_user_settings ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE alumni_audit_logs ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE alumni_donations ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE alumni_events ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE alumni_status ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE analytics_snapshots ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE announcement_comments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE announcement_read_receipts ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE announcement_templates ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE announcements ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE assignment_grades ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE assignments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE attendance_checkins ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE attendance_sessions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE attendance_sheets ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE backups ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE bursar_assignments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE campus_profiles ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE campus_reports ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE carryover_courses ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE cgpa_rules ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE class_notice_comments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE class_notices ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE class_rep_assignments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE class_rep_elections ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE class_rep_performance ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE class_rep_reports ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE comment_reactions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE complaint_status_history ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE complaints ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE connection_strikes ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE connections ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE content_moderation_log ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE course_materials ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE course_registrations ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE course_subcategories ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE courses ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE crf_backlog_price ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE crf_backlog_requests ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE crf_signature_assets ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE crf_signing_submissions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE departmental_events ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE dues ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE election_nominees ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE election_votes ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE event_attendees ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE expense_budgets ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE expenses ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE feature_flags ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE feed_posts ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE feedback_submissions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE gpa_scenarios ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE grade_appeals ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE graduation_fee ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE graduation_requests ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE group_files ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE group_members ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE group_messages ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE groups ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE job_applications ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE job_posts ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE lecturer_course_assignments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE lecturer_evaluations ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE lecturer_leave ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE lecturer_performance ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE level_promotions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE meeting_attendees ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE mentorship_requests ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE mentorship_sessions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE message_reactions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE messages ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE notification_preferences ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE notifications ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE password_resets ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE payment_batches ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE payment_cart ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE payments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE post_bookmarks ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE post_comments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE post_reactions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE profile_edit_logs ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE profile_update_requests ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE registered_courses ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE reports ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE result_audit_logs ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE results ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE role_assignment_logs ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE role_promotions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE scheduled_reports ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE semesters ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE sessions ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE signup_approvals ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE staff ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE staff_meetings ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE student_documents ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE student_onboardings ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE students ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE study_tasks ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE subcategories ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE subcategory_assignments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE timetable ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE transcript_requests ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE user_reputation ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE user_role_assignments ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE users ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE verification_records ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- ==================== TENANT-SCOPE EXISTING TABLES ====================
-- Each table gets: tenant_id (backfilled to the default tenant), a default
-- that reads the bound tenant, a foreign key and index, per-tenant uniqueness,
-- and an RLS policy. help_articles and ai_models are platform-wide catalogs
-- and stay global; tenants is the registry itself.
DO $$
DECLARE
    tbl TEXT;
    con RECORD;
    idx RECORD;
    tenant_tables TEXT[] := ARRAY[
    'academic_standing_rules', 'account_lockouts', 'active_sessions', 'admin_permissions', 'ai_interactions',
    'ai_predictions', 'ai_user_settings', 'alumni_audit_logs', 'alumni_donations', 'alumni_events',
    'alumni_status', 'analytics_snapshots', 'announcement_comments', 'announcement_read_receipts',
    'announcement_templates', 'announcements', 'assignment_grades', 'assignments', 'attendance_checkins',
    'attendance_sessions', 'attendance_sheets', 'backups', 'bursar_assignments', 'campus_profiles',
    'campus_reports', 'carryover_courses', 'cgpa_rules', 'class_notice_comments', 'class_notices',
    'class_rep_assignments', 'class_rep_elections', 'class_rep_performance', 'class_rep_reports',
    'comment_reactions', 'complaint_status_history', 'complaints', 'connection_strikes', 'connections',
    'content_moderation_log', 'course_materials', 'course_registrations', 'course_subcategories', 'courses',
    'crf_backlog_price', 'crf_backlog_requests', 'crf_signature_assets', 'crf_signing_submissions',
    'departmental_events', 'dues', 'election_nominees', 'election_votes', 'event_attendees',
    'expense_budgets', 'expenses', 'feature_flags', 'feed_posts', 'feedback_submissions', 'gpa_scenarios',
    'grade_appeals', 'graduation_fee', 'graduation_requests', 'group_files', 'group_members',
    'group_messages', 'groups', 'job_applications', 'job_posts', 'lecturer_course_assignments',
    'lecturer_evaluations', 'lecturer_leave', 'lecturer_performance', 'level_promotions',
    'meeting_attendees', 'mentorship_requests', 'mentorship_sessions', 'message_reactions', 'messages',
    'notification_preferences', 'notifications', 'password_resets', 'payment_batches', 'payment_cart',
    'payments', 'post_bookmarks', 'post_comments', 'post_reactions', 'profile_edit_logs',
    'profile_update_requests', 'registered_courses', 'reports', 'result_audit_logs', 'results',
    'role_assignment_logs', 'role_promotions', 'scheduled_reports', 'semesters', 'sessions',
    'signup_approvals', 'staff', 'staff_meetings', 'student_documents', 'student_onboardings', 'students',
    'study_tasks', 'subcategories', 'subcategory_assignments', 'timetable', 'transcript_requests',
    'user_reputation', 'user_role_assignments', 'users', 'verification_records'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET DEFAULT app_current_tenant()', tbl);
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id)',
                       tbl, tbl || '_tenant_fk');
        EXECUTE format('CREATE INDEX %I ON %I (tenant_id)', 'idx_' || tbl || '_tenant_id', tbl);

        -- Every uniqueness rule becomes per-tenant: "email is unique" becomes
        -- "email is unique within a tenant". Constraints are rebuilt under the
        -- same names so anything referring to them by name keeps working.
        FOR con IN
            SELECT conname, pg_get_constraintdef(oid) AS def
            FROM pg_constraint
            WHERE conrelid = tbl::regclass AND contype = 'u'
        LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, con.conname);
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', tbl, con.conname,
                           regexp_replace(con.def, '^UNIQUE \(', 'UNIQUE (tenant_id, '));
        END LOOP;

        -- Unique indexes that are not backed by a constraint.
        FOR idx IN
            SELECT c.relname AS idx_name, pg_get_indexdef(i.indexrelid) AS def
            FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE i.indrelid = tbl::regclass AND i.indisunique AND NOT i.indisprimary
              AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid)
        LOOP
            EXECUTE format('DROP INDEX %I', idx.idx_name);
            EXECUTE regexp_replace(idx.def, 'USING btree \(', 'USING btree (tenant_id, ');
        END LOOP;

        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_current_tenant()) '
            'WITH CHECK (tenant_id = app_current_tenant())', tbl);
    END LOOP;
END $$;

-- ==================== TENANT-CONSISTENT REFERENCES ====================
-- Every foreign key between tenant tables is rebuilt as (tenant_id, column)
-- -> (tenant_id, referenced column). A row can then only point at a row of
-- its own tenant. RLS alone does not give this: referential-integrity checks
-- run without RLS, so without this step a request in one tenant could link to
-- another tenant's row by UUID. Each referenced column gets a per-tenant
-- unique constraint (named <table>_tenant_<column>_key) to support the key.
DO $$
DECLARE
    fk RECORD;
    uq_name TEXT;
    action TEXT;
BEGIN
    FOR fk IN
        SELECT c.conname,
               c.conrelid::regclass::text AS from_tbl,
               c.confrelid::regclass::text AS to_tbl,
               af.attname AS from_col,
               at.attname AS to_col,
               c.confdeltype
        FROM pg_constraint c
        JOIN pg_attribute af ON af.attrelid = c.conrelid AND af.attnum = c.conkey[1]
        JOIN pg_attribute at ON at.attrelid = c.confrelid AND at.attnum = c.confkey[1]
        WHERE c.contype = 'f'
          AND c.connamespace = 'public'::regnamespace
          AND cardinality(c.conkey) = 1
          AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.conrelid
                      AND x.attname = 'tenant_id' AND NOT x.attisdropped)
          AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.confrelid
                      AND x.attname = 'tenant_id' AND NOT x.attisdropped)
    LOOP
        uq_name := fk.to_tbl || '_tenant_' || fk.to_col || '_key';
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = uq_name) THEN
            EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I UNIQUE (tenant_id, %I)',
                           fk.to_tbl, uq_name, fk.to_col);
        END IF;

        action := CASE fk.confdeltype
                      WHEN 'c' THEN ' ON DELETE CASCADE'
                      WHEN 'n' THEN format(' ON DELETE SET NULL (%I)', fk.from_col)
                      ELSE ''
                  END;

        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.from_tbl, fk.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (tenant_id, %I) REFERENCES %s (tenant_id, %I)%s',
                       fk.from_tbl, fk.conname, fk.from_col, fk.to_tbl, fk.to_col, action);
    END LOOP;
END $$;

-- A new student's pending results are linked by matric number. Scope that
-- match to the student's tenant so one department's record can never claim
-- another department's results, even if RLS were ever bypassed.
CREATE OR REPLACE FUNCTION link_pending_results()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE results
    SET student_id = NEW.id
    WHERE matric_number = NEW.matric_number
      AND student_id IS NULL
      AND tenant_id = NEW.tenant_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================== PER-TENANT COUNTERS ====================
-- Receipt numbers used to come from global sequences, so every department
-- shared one receipt book. Each tenant now keeps its own counters.
CREATE TABLE tenant_counters (
    tenant_id UUID NOT NULL DEFAULT app_current_tenant() REFERENCES tenants(id),
    name VARCHAR(64) NOT NULL,
    value BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, name)
);
ALTER TABLE tenant_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_counters
    USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());

-- Carry the existing receipt numbering over to the default tenant.
INSERT INTO tenant_counters (tenant_id, name, value)
SELECT '00000000-0000-4000-8000-000000000001', 'department_receipt',
       CASE WHEN is_called THEN last_value ELSE 0 END
FROM department_receipt_seq;

INSERT INTO tenant_counters (tenant_id, name, value)
SELECT '00000000-0000-4000-8000-000000000001', 'class_receipt',
       CASE WHEN is_called THEN last_value ELSE 0 END
FROM class_receipt_seq;

DROP SEQUENCE department_receipt_seq;
DROP SEQUENCE class_receipt_seq;

-- ==================== TENANT LOOKUPS FOR TOKEN-ADDRESSED ROUTES ====================
-- A few public endpoints are addressed by an opaque token or a payment
-- reference instead of a signed-in session: calendar feeds, email unsubscribe
-- links, and Paystack webhooks. Each function returns only the tenant id that
-- owns the token, so the caller can bind that tenant and then run its normal,
-- tenant-scoped query. SECURITY DEFINER lets the lookup see every tenant; the
-- search_path is pinned so the body cannot be hijacked.

CREATE OR REPLACE FUNCTION tenant_for_calendar_token(p_token TEXT) RETURNS UUID
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT tenant_id FROM users WHERE calendar_feed_token = p_token LIMIT 1
$$;

CREATE OR REPLACE FUNCTION tenant_for_unsubscribe_token(p_token TEXT) RETURNS UUID
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT tenant_id FROM notification_preferences WHERE unsubscribe_token = p_token LIMIT 1
$$;

CREATE OR REPLACE FUNCTION tenant_for_paystack_reference(p_reference TEXT) RETURNS UUID
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT tenant_id FROM payments WHERE paystack_reference = p_reference
    UNION ALL
    SELECT tenant_id FROM payment_batches WHERE paystack_reference = p_reference
    UNION ALL
    SELECT tenant_id FROM alumni_donations WHERE paystack_reference = p_reference
    LIMIT 1
$$;
