DROP TABLE IF EXISTS announcement_comments CASCADE;
DROP TABLE IF EXISTS announcement_templates CASCADE;
DROP TABLE IF EXISTS announcement_read_receipts CASCADE;

ALTER TABLE announcements
    DROP COLUMN IF EXISTS summary,
    DROP COLUMN IF EXISTS priority,
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS target_levels,
    DROP COLUMN IF EXISTS target_departments,
    DROP COLUMN IF EXISTS attachments,
    DROP COLUMN IF EXISTS requires_acknowledgment,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS scheduled_for,
    DROP COLUMN IF EXISTS read_count,
    DROP COLUMN IF EXISTS acknowledged_count,
    DROP COLUMN IF EXISTS pin_order,
    DROP COLUMN IF EXISTS updated_at;

DROP TYPE IF EXISTS announcement_status CASCADE;
DROP TYPE IF EXISTS announcement_category CASCADE;
DROP TYPE IF EXISTS announcement_priority CASCADE;

DROP TABLE IF EXISTS student_onboardings CASCADE;
DROP TYPE IF EXISTS onboarding_status CASCADE;

DROP TABLE IF EXISTS verification_records CASCADE;
