DROP TABLE IF EXISTS connect_media,connect_recording_intents,connect_media_usage;
DROP INDEX IF EXISTS messages_client_nonce,group_messages_client_nonce,group_messages_tenant_identity;
ALTER TABLE messages DROP COLUMN client_nonce;
ALTER TABLE group_messages DROP COLUMN client_nonce;
