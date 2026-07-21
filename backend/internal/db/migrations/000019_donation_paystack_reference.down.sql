DROP INDEX IF EXISTS idx_alumni_donations_paystack_ref;
ALTER TABLE alumni_donations DROP COLUMN IF EXISTS paystack_reference;
