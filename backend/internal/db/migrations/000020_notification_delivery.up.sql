-- Durable notification events and channel-specific delivery jobs, tenant isolated.
CREATE TABLE notification_devices (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),tenant_id UUID NOT NULL DEFAULT app_current_tenant(),user_id UUID NOT NULL,
 platform TEXT NOT NULL CHECK(platform IN ('expo','web')),address TEXT NOT NULL CHECK(length(address)<=4096),subscription JSONB,
 active BOOLEAN NOT NULL DEFAULT true,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,address),FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id) ON DELETE CASCADE
);
INSERT INTO notification_devices(tenant_id,user_id,platform,address)
SELECT tenant_id,user_id,'expo',push_token FROM notification_preferences WHERE push_token IS NOT NULL AND push_token<>'' AND length(push_token)<=4096
ON CONFLICT(tenant_id,address) DO NOTHING;
CREATE TABLE notification_events (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),tenant_id UUID NOT NULL DEFAULT app_current_tenant(),user_id UUID NOT NULL,
 event_key TEXT NOT NULL,payload JSONB NOT NULL,notification_id UUID,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id,event_key),FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE notification_deliveries (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),tenant_id UUID NOT NULL DEFAULT app_current_tenant(),event_id UUID NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('in_app','email','push')),device_id UUID,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','accepted','simulated','skipped','failed')),
 attempts INT NOT NULL DEFAULT 0,next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),lease_until TIMESTAMPTZ,
 last_error TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,event_id) REFERENCES notification_events(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,device_id) REFERENCES notification_devices(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX notification_delivery_due ON notification_deliveries(tenant_id,status,next_attempt_at);
CREATE UNIQUE INDEX notification_delivery_once ON notification_deliveries(tenant_id,event_id,channel,COALESCE(device_id,'00000000-0000-0000-0000-000000000000'::uuid));
ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_devices USING(tenant_id=app_current_tenant()) WITH CHECK(tenant_id=app_current_tenant());
CREATE POLICY tenant_isolation ON notification_events USING(tenant_id=app_current_tenant()) WITH CHECK(tenant_id=app_current_tenant());
CREATE POLICY tenant_isolation ON notification_deliveries USING(tenant_id=app_current_tenant()) WITH CHECK(tenant_id=app_current_tenant());
