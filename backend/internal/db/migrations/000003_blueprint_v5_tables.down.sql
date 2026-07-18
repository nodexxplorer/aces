-- 000003_blueprint_v5_tables.down.sql
-- Reverse all tables added in the up migration

DROP TRIGGER IF EXISTS update_job_posts_updated_at ON job_posts;
DROP TRIGGER IF EXISTS update_alumni_status_updated_at ON alumni_status;
DROP TRIGGER IF EXISTS update_skill_listings_updated_at ON skill_listings;
DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
DROP TRIGGER IF EXISTS update_manuals_updated_at ON manuals;

DROP TABLE IF EXISTS event_attendees CASCADE;
DROP TABLE IF EXISTS alumni_events CASCADE;
DROP TABLE IF EXISTS job_applications CASCADE;
DROP TABLE IF EXISTS job_posts CASCADE;
DROP TABLE IF EXISTS mentorship_requests CASCADE;
DROP TABLE IF EXISTS alumni_status CASCADE;
DROP TABLE IF EXISTS user_reputation CASCADE;
DROP TABLE IF EXISTS skill_ratings CASCADE;
DROP TABLE IF EXISTS trade_offers CASCADE;
DROP TABLE IF EXISTS skill_listings CASCADE;
DROP TABLE IF EXISTS skill_categories CASCADE;
DROP TABLE IF EXISTS group_messages CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS connections CASCADE;
DROP TABLE IF EXISTS practical_enrollments CASCADE;
DROP TABLE IF EXISTS manual_print_queue CASCADE;
DROP TABLE IF EXISTS manual_purchases CASCADE;
DROP TABLE IF EXISTS manuals CASCADE;
DROP TABLE IF EXISTS course_subcategories CASCADE;
DROP TABLE IF EXISTS bursar_assignments CASCADE;
DROP TABLE IF EXISTS role_promotions CASCADE;
DROP TABLE IF EXISTS user_role_assignments CASCADE;

DROP TYPE IF EXISTS alumni_verification_status;
DROP TYPE IF EXISTS application_status;
DROP TYPE IF EXISTS job_type;
DROP TYPE IF EXISTS mentorship_status;
DROP TYPE IF EXISTS skill_level;
DROP TYPE IF EXISTS trade_status;
DROP TYPE IF EXISTS connection_status;
