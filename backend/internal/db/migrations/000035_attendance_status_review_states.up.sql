-- attendance_sessions.status only allowed ('draft','open','closed','finalized'),
-- but submitAttendanceSession sets 'pending_lecturer_review' and
-- reviewAttendanceSession sets 'approved'/'changes_requested'/'rejected' —
-- every one of those UPDATEs silently violated the CHECK constraint, so a
-- class rep's "Send to Lecturer Dashboard" never actually changed the
-- session's status, and the lecturer's review queue (which filters on
-- status IN ('pending_lecturer_review','pending','submitted')) stayed
-- permanently empty no matter what class reps submitted.
ALTER TABLE attendance_sessions DROP CONSTRAINT attendance_sessions_status_check;
ALTER TABLE attendance_sessions ADD CONSTRAINT attendance_sessions_status_check
  CHECK (status IN (
    'draft', 'open', 'closed', 'finalized',
    'pending_lecturer_review', 'pending', 'submitted',
    'approved', 'changes_requested', 'rejected'
  ));
