CREATE UNIQUE INDEX group_messages_tenant_identity ON group_messages(tenant_id,id);
ALTER TABLE messages ADD COLUMN client_nonce UUID;
ALTER TABLE group_messages ADD COLUMN client_nonce UUID;
CREATE UNIQUE INDEX messages_client_nonce ON messages(tenant_id,sender_id,client_nonce) WHERE client_nonce IS NOT NULL;
CREATE UNIQUE INDEX group_messages_client_nonce ON group_messages(tenant_id,sender_id,client_nonce) WHERE client_nonce IS NOT NULL;
CREATE TABLE connect_recording_intents (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID NOT NULL DEFAULT app_current_tenant(), owner_id UUID NOT NULL,
 target_kind TEXT NOT NULL CHECK(target_kind IN ('dm','group')), target_id UUID NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '10 minutes', used BOOLEAN NOT NULL DEFAULT false,
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id)
);
CREATE TABLE connect_media (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL DEFAULT app_current_tenant(), owner_id UUID NOT NULL,
 target_kind TEXT NOT NULL CHECK(target_kind IN ('dm','group')), target_id UUID NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('image','voice')), state TEXT NOT NULL CHECK(state IN ('processing','ready')),
 upload_nonce UUID NOT NULL, recording_intent UUID,
 path TEXT NOT NULL, mime TEXT NOT NULL, input_bytes BIGINT NOT NULL CHECK(input_bytes BETWEEN 1 AND 8388608),
 bytes BIGINT NOT NULL DEFAULT 0, width INTEGER, height INTEGER, duration_seconds DOUBLE PRECISION,
 message_id UUID, group_message_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,owner_id,upload_nonce),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,recording_intent) REFERENCES connect_recording_intents(tenant_id,id),
 FOREIGN KEY(tenant_id,message_id) REFERENCES messages(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,group_message_id) REFERENCES group_messages(tenant_id,id) ON DELETE CASCADE,
 CHECK(num_nonnulls(message_id,group_message_id)<=1),
 CHECK(message_id IS NULL OR target_kind='dm'), CHECK(group_message_id IS NULL OR target_kind='group'),
 CHECK(kind<>'voice' OR recording_intent IS NOT NULL)
);
CREATE INDEX connect_media_owner_quota ON connect_media(tenant_id,owner_id,created_at);
CREATE INDEX connect_media_message ON connect_media(tenant_id,message_id);
CREATE INDEX connect_media_group_message ON connect_media(tenant_id,group_message_id);
ALTER TABLE connect_recording_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON connect_recording_intents USING(tenant_id=app_current_tenant()) WITH CHECK(tenant_id=app_current_tenant());
ALTER TABLE connect_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON connect_media USING(tenant_id=app_current_tenant()) WITH CHECK(tenant_id=app_current_tenant());

-- Durable quota usage survives discarded uploads and failed decoding.
CREATE TABLE connect_media_usage (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID NOT NULL DEFAULT app_current_tenant(), owner_id UUID NOT NULL,
 input_bytes BIGINT NOT NULL CHECK(input_bytes BETWEEN 1 AND 8388608), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX connect_media_usage_quota ON connect_media_usage(tenant_id,owner_id,created_at);
ALTER TABLE connect_media_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON connect_media_usage USING(tenant_id=app_current_tenant()) WITH CHECK(tenant_id=app_current_tenant());
