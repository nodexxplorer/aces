-- Links a payment to the course form it pays the signing fee for. Each
-- regular course form gets its own fee payment; backlog forms are paid for
-- through the backlog request payment and leave this column NULL.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS crf_submission_id UUID REFERENCES crf_signing_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_crf_submission_id
    ON payments (crf_submission_id)
    WHERE crf_submission_id IS NOT NULL;
