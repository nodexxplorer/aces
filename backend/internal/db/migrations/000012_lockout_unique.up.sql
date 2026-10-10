-- The staff lockout keeps one account_lockouts row per user. Without a unique
-- key, the "create the row if missing" insert never conflicts and would add a
-- new row on every failed sign-in. Keep the oldest row for each user, then
-- make user_id unique.
DELETE FROM account_lockouts a
USING account_lockouts b
WHERE a.user_id = b.user_id
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_lockouts_user ON account_lockouts(user_id);
