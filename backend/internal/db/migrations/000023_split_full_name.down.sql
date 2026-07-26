-- Drop generated full_name
ALTER TABLE users DROP COLUMN full_name;

-- Recreate full_name as regular column
ALTER TABLE users ADD COLUMN full_name VARCHAR(255) NOT NULL DEFAULT '';

-- Populate from first_name, middle_name, last_name
UPDATE users SET full_name = TRIM(CONCAT_WS(' ', first_name, middle_name, last_name));

-- Drop split columns
ALTER TABLE users DROP COLUMN first_name;
ALTER TABLE users DROP COLUMN last_name;
