-- Removes the manuals/practicals feature. Full original schema is preserved
-- in docs/archived-features/practicals-and-manuals.md and recreated exactly
-- by this migration's .down.sql.
DROP TABLE IF EXISTS practical_enrollments;
DROP TABLE IF EXISTS manual_print_queue;
DROP TABLE IF EXISTS manual_purchases;
DROP TABLE IF EXISTS manuals;
