-- Invitation authority and history are department-scoped, including bootstrap.
CREATE TABLE department_onboarding (
    tenant_id UUID PRIMARY KEY DEFAULT app_current_tenant() REFERENCES tenants(id),
    hod_bootstrapped_at TIMESTAMPTZ
);
CREATE TABLE access_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT app_current_tenant() REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL CHECK (email = lower(email)),
    name VARCHAR(200) NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('lecturer', 'delegated_admin', 'hod')),
    grants JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('pending_approval', 'sent', 'accepted', 'expired', 'revoked')),
    bootstrap BOOLEAN NOT NULL DEFAULT false,
    requested_by UUID,
    approved_by UUID,
    accepted_by UUID,
    token_hash TEXT UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ,
    delivery_failed BOOLEAN NOT NULL DEFAULT false,
    send_window_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    send_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, requested_by) REFERENCES users(tenant_id, id),
    FOREIGN KEY (tenant_id, approved_by) REFERENCES users(tenant_id, id),
    FOREIGN KEY (tenant_id, accepted_by) REFERENCES users(tenant_id, id),
    CHECK (NOT bootstrap OR (role = 'hod' AND requested_by IS NULL AND approved_by IS NULL))
);
CREATE UNIQUE INDEX access_invitation_open ON access_invitations(tenant_id, email, role)
    WHERE status IN ('pending_approval', 'sent');
CREATE UNIQUE INDEX access_invitation_bootstrap ON access_invitations(tenant_id)
    WHERE bootstrap AND status IN ('pending_approval', 'sent');
CREATE INDEX access_invitation_department ON access_invitations(tenant_id, created_at DESC);
CREATE TABLE access_invitation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT app_current_tenant() REFERENCES tenants(id),
    invitation_id UUID NOT NULL,
    actor_id UUID,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, invitation_id) REFERENCES access_invitations(tenant_id, id),
    FOREIGN KEY (tenant_id, actor_id) REFERENCES users(tenant_id, id)
);
-- Never reopen bootstrap for an established department, even if its HOD is
-- inactive or a previous HOD assignment has been revoked.
INSERT INTO department_onboarding(tenant_id, hod_bootstrapped_at)
SELECT t.id, now() FROM tenants t WHERE
    EXISTS (SELECT 1 FROM users u WHERE u.tenant_id=t.id AND u.role='hod') OR
    EXISTS (SELECT 1 FROM user_role_assignments r WHERE r.tenant_id=t.id AND r.role='hod') OR
    EXISTS (SELECT 1 FROM role_assignment_logs l WHERE l.tenant_id=t.id AND l.role='hod');
ALTER TABLE department_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON department_onboarding
    USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
ALTER TABLE access_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON access_invitations
    USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
ALTER TABLE access_invitation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON access_invitation_events
    USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
