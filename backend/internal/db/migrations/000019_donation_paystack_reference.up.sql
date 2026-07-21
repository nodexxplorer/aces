ALTER TABLE alumni_donations ADD COLUMN paystack_reference VARCHAR(100);
CREATE INDEX idx_alumni_donations_paystack_ref ON alumni_donations(paystack_reference);

UPDATE alumni_donations SET status = 'completed' WHERE status = 'completed';
