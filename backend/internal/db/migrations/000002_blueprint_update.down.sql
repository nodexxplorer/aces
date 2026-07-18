DROP TABLE IF EXISTS academic_standing_rules;
DROP TABLE IF EXISTS cgpa_rules;
DROP TABLE IF EXISTS signup_approvals;

ALTER TABLE courses DROP COLUMN IF EXISTS course_type;

ALTER TABLE students DROP COLUMN IF EXISTS onboarding_completed;
ALTER TABLE students DROP COLUMN IF EXISTS year_admitted;
ALTER TABLE students DROP COLUMN IF EXISTS admission_mode;

ALTER TABLE users DROP COLUMN IF EXISTS approved_at;
ALTER TABLE users DROP COLUMN IF EXISTS approved_by;
ALTER TABLE users DROP COLUMN IF EXISTS is_approved;
