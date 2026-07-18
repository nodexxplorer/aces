-- Add personal profile fields to users table for onboarding and admin editing
ALTER TABLE users ADD COLUMN date_of_birth DATE;
ALTER TABLE users ADD COLUMN emergency_contact_name VARCHAR(255);
ALTER TABLE users ADD COLUMN emergency_contact_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN home_address TEXT;
