-- Reverse of 000016_campus_connect_v2.up.sql, dropped in dependency order
-- (triggers, then tables — children before parents — then types).
--
-- report_status is deliberately NOT dropped here: it was created by
-- migration 000011 (not this one — 000016's CREATE TYPE was a guarded
-- no-op against the one 000011 already made) and later extended by
-- migration 000024, so this migration doesn't own it.

DROP TRIGGER IF EXISTS update_post_comments_updated_at ON post_comments;
DROP TRIGGER IF EXISTS update_feed_posts_updated_at ON feed_posts;
DROP TRIGGER IF EXISTS update_campus_profiles_updated_at ON campus_profiles;

DROP TABLE IF EXISTS post_bookmarks;
DROP TABLE IF EXISTS campus_reports;
DROP TABLE IF EXISTS connection_strikes;
DROP TABLE IF EXISTS group_files;
DROP TABLE IF EXISTS message_reactions;
DROP TABLE IF EXISTS comment_reactions;
DROP TABLE IF EXISTS post_reactions;
DROP TABLE IF EXISTS post_comments;
DROP TABLE IF EXISTS feed_posts;
DROP TABLE IF EXISTS campus_profiles;

DROP TYPE IF EXISTS report_target_type;
DROP TYPE IF EXISTS reaction_type;
DROP TYPE IF EXISTS feed_audience;
DROP TYPE IF EXISTS feed_post_type;
