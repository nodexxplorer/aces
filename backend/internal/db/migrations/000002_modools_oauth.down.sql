ALTER TABLE students
    ALTER COLUMN entry_year SET NOT NULL;

ALTER TABLE students
    ALTER COLUMN matric_number SET NOT NULL;

ALTER TABLE users
    DROP COLUMN IF EXISTS modools_refresh_token,
    DROP COLUMN IF EXISTS modools_sub;
