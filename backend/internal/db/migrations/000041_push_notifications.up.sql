-- The device's Expo push token, letting the backend deliver real OS
-- notifications instead of only the in-app/WebSocket ones. Nullable — most
-- rows won't have one until that device registers (web users never will).
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_token TEXT;
