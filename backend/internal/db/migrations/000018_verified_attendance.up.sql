-- New pilot records are deliberately isolated from legacy sheets/check-ins.
CREATE TABLE attendance_v2_sessions (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 tenant_id UUID NOT NULL DEFAULT app_current_tenant() REFERENCES tenants(id),
 course_id UUID NOT NULL, semester_id UUID NOT NULL, lecturer_id UUID NOT NULL, delegate_id UUID,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200), venue TEXT NOT NULL CHECK(length(venue) BETWEEN 1 AND 200),
 scheduled_at TIMESTAMPTZ NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 1 AND 180),
 latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, radius_m INTEGER NOT NULL DEFAULT 100 CHECK(radius_m BETWEEN 20 AND 1000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed','finalized','cancelled')),
 secret TEXT NOT NULL, opened_at TIMESTAMPTZ, closes_at TIMESTAMPTZ, finalized_at TIMESTAMPTZ,
 revision INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id),
 FOREIGN KEY(tenant_id,semester_id) REFERENCES semesters(tenant_id,id),
 FOREIGN KEY(tenant_id,lecturer_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,delegate_id) REFERENCES users(tenant_id,id),
 CHECK((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
CREATE UNIQUE INDEX attendance_v2_one_open ON attendance_v2_sessions(tenant_id,course_id,semester_id) WHERE status='open';
CREATE UNIQUE INDEX attendance_v2_no_duplicate_lecture ON attendance_v2_sessions(tenant_id,course_id,semester_id,scheduled_at) WHERE status<>'cancelled';
CREATE INDEX attendance_v2_course ON attendance_v2_sessions(tenant_id,course_id,semester_id,scheduled_at);
-- Roster is frozen at opening: subsequently withdrawing a registration must not
-- erase an absence, and newly registered students do not inherit past absences.
CREATE TABLE attendance_v2_records (
 tenant_id UUID NOT NULL DEFAULT app_current_tenant(), session_id UUID NOT NULL, user_id UUID NOT NULL,
 verification TEXT NOT NULL DEFAULT 'pending' CHECK(verification IN ('pending','verified','flagged','approved','rejected')),
 outcome TEXT NOT NULL DEFAULT 'absent' CHECK(outcome IN ('present','late','absent')),
 flags TEXT[] NOT NULL DEFAULT '{}', submitted_at TIMESTAMPTZ,
 device_hash TEXT, distance_m DOUBLE PRECISION, accuracy_m DOUBLE PRECISION,
 reviewed_by UUID, review_reason TEXT, revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,session_id,user_id),
 FOREIGN KEY(tenant_id,session_id) REFERENCES attendance_v2_sessions(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,reviewed_by) REFERENCES users(tenant_id,id)
);
CREATE INDEX attendance_v2_records_student ON attendance_v2_records(tenant_id,user_id,session_id);
-- Browser registration is a soft signal, not hardware attestation. Never store
-- the bearer credential itself. New/replaced devices require supervised review.
CREATE TABLE attendance_v2_devices (
 tenant_id UUID NOT NULL DEFAULT app_current_tenant(), user_id UUID NOT NULL,
 device_hash TEXT NOT NULL, approved BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id,device_hash),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX attendance_v2_devices_shared ON attendance_v2_devices(tenant_id,device_hash);
CREATE TABLE attendance_v2_disputes (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID NOT NULL DEFAULT app_current_tenant(),
 session_id UUID NOT NULL, user_id UUID NOT NULL, reason TEXT NOT NULL CHECK(length(reason) BETWEEN 5 AND 2000),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 resolution TEXT, resolved_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ,
 FOREIGN KEY(tenant_id,session_id,user_id) REFERENCES attendance_v2_records(tenant_id,session_id,user_id),
 FOREIGN KEY(tenant_id,resolved_by) REFERENCES users(tenant_id,id)
);
CREATE UNIQUE INDEX attendance_v2_dispute_open ON attendance_v2_disputes(tenant_id,session_id,user_id) WHERE status='open';
CREATE TABLE attendance_v2_events (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID NOT NULL DEFAULT app_current_tenant(),
 session_id UUID NOT NULL, actor_id UUID NOT NULL, action TEXT NOT NULL,
 evidence JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,session_id) REFERENCES attendance_v2_sessions(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX attendance_v2_events_session ON attendance_v2_events(tenant_id,session_id,created_at);
CREATE TABLE attendance_v2_snapshots (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID NOT NULL DEFAULT app_current_tenant(),
 course_id UUID NOT NULL, semester_id UUID NOT NULL, version INTEGER NOT NULL,
 policy_version TEXT NOT NULL DEFAULT 'pilot-session-75-v1', threshold INTEGER NOT NULL DEFAULT 75 CHECK(threshold=75),
 generated_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), results JSONB NOT NULL, basis JSONB NOT NULL,
 UNIQUE(tenant_id,course_id,semester_id,version),
 FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id),
 FOREIGN KEY(tenant_id,semester_id) REFERENCES semesters(tenant_id,id),
 FOREIGN KEY(tenant_id,generated_by) REFERENCES users(tenant_id,id)
);
-- Audits and published snapshots cannot be rewritten even by a runtime role
-- which has blanket table UPDATE/DELETE grants. DB owners remain trusted.
CREATE FUNCTION attendance_v2_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'attendance audit and snapshots are append-only'; END $$;
CREATE TRIGGER attendance_v2_events_immutable BEFORE UPDATE OR DELETE ON attendance_v2_events FOR EACH ROW EXECUTE FUNCTION attendance_v2_immutable();
CREATE TRIGGER attendance_v2_snapshots_immutable BEFORE UPDATE OR DELETE ON attendance_v2_snapshots FOR EACH ROW EXECUTE FUNCTION attendance_v2_immutable();
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['attendance_v2_sessions','attendance_v2_records','attendance_v2_devices','attendance_v2_disputes','attendance_v2_events','attendance_v2_snapshots'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=app_current_tenant()) WITH CHECK (tenant_id=app_current_tenant())',tbl);
 END LOOP;
END $$;
