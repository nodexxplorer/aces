-- A per-user secret token embedded in their calendar subscription URL
-- (GET /calendar/feed/:token). Calendar clients (Google/Apple/Outlook)
-- fetch subscription URLs with no auth headers at all, so this token IS
-- the auth — generated lazily on first request, not at signup, and
-- regenerable to invalidate a leaked link.
ALTER TABLE users ADD COLUMN calendar_feed_token VARCHAR(64) UNIQUE;
