-- Add first_name and last_name columns
ALTER TABLE users ADD COLUMN first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN last_name VARCHAR(255);

-- Split existing full_name into first_name and last_name
-- last_name = last word, first_name = everything before it
UPDATE users SET
    last_name  = TRIM(SPLIT_PART(full_name, ' ', GREATEST(1, LENGTH(full_name) - LENGTH(REPLACE(full_name, ' ', ''))))),
    first_name = TRIM(REPLACE(full_name, SPLIT_PART(full_name, ' ', GREATEST(1, LENGTH(full_name) - LENGTH(REPLACE(full_name, ' ', '')))), ''));

-- Handle single-word names (no space): put everything in first_name
UPDATE users SET first_name = full_name, last_name = '' WHERE last_name IS NULL OR TRIM(last_name) = '';

-- Make columns NOT NULL with defaults
ALTER TABLE users ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_name SET DEFAULT '';
ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;

-- Drop old full_name column, recreate as stored generated column
ALTER TABLE users DROP COLUMN full_name;
ALTER TABLE users ADD COLUMN full_name VARCHAR(255) GENERATED ALWAYS AS (
  CASE
    WHEN middle_name IS NULL OR middle_name = '' THEN TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    ELSE TRIM(COALESCE(first_name, '') || ' ' || COALESCE(middle_name, '') || ' ' || COALESCE(last_name, ''))
  END
) STORED;
