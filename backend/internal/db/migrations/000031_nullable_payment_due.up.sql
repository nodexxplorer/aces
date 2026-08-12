-- payment_type already includes non-due categories (manual, materials,
-- transcript_fee, other), but due_id NOT NULL made it impossible to ever
-- insert one of those — there's no "due" behind a manual purchase.
ALTER TABLE payments ALTER COLUMN due_id DROP NOT NULL;
