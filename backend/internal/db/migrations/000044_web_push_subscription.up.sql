-- The browser's PushSubscription object (endpoint + keys), JSON-serialized
-- as-is — this is the web equivalent of push_token for mobile, letting the
-- backend deliver a real OS/browser notification to a logged-in web session
-- via the Web Push protocol (VAPID), not just the in-app/WebSocket ones.
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS web_push_subscription TEXT;
