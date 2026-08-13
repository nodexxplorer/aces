-- Fails loudly with an actionable message instead of a bare NOT NULL
-- constraint violation if live data has payments.due_id rows that were
-- only ever valid because this column was made nullable — rolling back
-- blind would either fail opaquely or (if the offending rows were deleted
-- first) silently destroy payment records.
DO $$
DECLARE
    null_count INT;
BEGIN
    SELECT COUNT(*) INTO null_count FROM payments WHERE due_id IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'Cannot revert 000031: % payment row(s) have a NULL due_id. Resolve or manually reassign these rows before rolling back this migration.', null_count;
    END IF;
END $$;

ALTER TABLE payments ALTER COLUMN due_id SET NOT NULL;
