-- Reverse of the squashed baseline: a full from-scratch teardown of the
-- application schema. Data is not recoverable through this path — use a
-- pg_dump backup instead.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
