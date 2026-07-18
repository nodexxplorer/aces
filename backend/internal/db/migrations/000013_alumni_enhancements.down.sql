-- Reverse Alumni Enhancement Migration

DROP TRIGGER IF EXISTS update_alumni_donations_updated_at ON alumni_donations;

ALTER TABLE alumni_donations DROP COLUMN IF EXISTS updated_at;

ALTER TABLE alumni_status DROP COLUMN IF EXISTS profile_photo;
ALTER TABLE alumni_status DROP COLUMN IF EXISTS industry;
ALTER TABLE alumni_status DROP COLUMN IF EXISTS job_title;
ALTER TABLE alumni_status DROP COLUMN IF EXISTS email;
ALTER TABLE alumni_status DROP COLUMN IF EXISTS phone;
ALTER TABLE alumni_status DROP COLUMN IF EXISTS cgpa_at_graduation;
ALTER TABLE alumni_status DROP COLUMN IF EXISTS department;
ALTER TABLE alumni_status DROP COLUMN IF EXISTS full_name;
ALTER TABLE alumni_status DROP COLUMN IF EXISTS matric_number;

ALTER TABLE alumni_events DROP COLUMN IF EXISTS attendance_count;
ALTER TABLE alumni_events DROP COLUMN IF EXISTS rsvp_count;
ALTER TABLE alumni_events DROP COLUMN IF EXISTS approved_by;
ALTER TABLE alumni_events DROP COLUMN IF EXISTS status;
ALTER TABLE alumni_events DROP COLUMN IF EXISTS target_audience;

ALTER TABLE job_posts DROP COLUMN IF EXISTS applications_count;
ALTER TABLE job_posts DROP COLUMN IF EXISTS views_count;
ALTER TABLE job_posts DROP COLUMN IF EXISTS approved_by;
ALTER TABLE job_posts DROP COLUMN IF EXISTS application_method;
ALTER TABLE job_posts DROP COLUMN IF EXISTS target_departments;
ALTER TABLE job_posts DROP COLUMN IF EXISTS target_levels;
ALTER TABLE job_posts DROP COLUMN IF EXISTS responsibilities;
ALTER TABLE job_posts DROP COLUMN IF EXISTS industry;

DROP TABLE IF EXISTS alumni_audit_logs;
DROP TABLE IF EXISTS mentorship_sessions;
