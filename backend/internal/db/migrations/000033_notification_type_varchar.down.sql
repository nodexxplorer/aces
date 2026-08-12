-- Fails loudly with an actionable message instead of a bare enum-cast
-- error if live data has notification types invented after this column
-- became free text (payments, academic events, attendance, etc.) that
-- don't fit back into the original 9-value enum.
DO $$
DECLARE
    bad_count INT;
BEGIN
    SELECT COUNT(*) INTO bad_count FROM notifications
    WHERE type NOT IN (
        'result_published', 'payment_due', 'complaint_resolved',
        'assignment_graded', 'deadline_reminder', 'exam_conflict',
        'profile_approved', 'announcement', 'general'
    );
    IF bad_count > 0 THEN
        RAISE EXCEPTION 'Cannot revert 000033: % notification row(s) use a type value outside the original 9-value enum. Resolve or remap these rows before rolling back this migration.', bad_count;
    END IF;
END $$;

ALTER TABLE notifications ALTER COLUMN type TYPE notification_type USING type::notification_type;
