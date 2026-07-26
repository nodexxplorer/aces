-- Add middle_name column to users table
ALTER TABLE users ADD COLUMN middle_name TEXT;

-- Populate middle_name from full_name where possible
-- full_name currently stores "FirstName LastName", so we can't auto-populate middle_name
-- It will be set during onboarding
