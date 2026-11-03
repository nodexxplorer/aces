DROP INDEX IF EXISTS idx_payments_crf_submission_id;

ALTER TABLE payments
    DROP COLUMN IF EXISTS crf_submission_id;
