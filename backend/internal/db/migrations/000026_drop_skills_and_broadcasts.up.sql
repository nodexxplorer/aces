-- Drop unused Skills & Trade marketplace tables
DROP TABLE IF EXISTS trade_offers CASCADE;
DROP TABLE IF EXISTS skill_ratings CASCADE;
DROP TABLE IF EXISTS skill_listings CASCADE;
DROP TABLE IF EXISTS skill_categories CASCADE;

-- Drop unused Emergency Broadcasts tables and enum
DROP TABLE IF EXISTS broadcast_acknowledgments CASCADE;
DROP TABLE IF EXISTS emergency_broadcasts CASCADE;
DROP TYPE IF EXISTS broadcast_priority CASCADE;
