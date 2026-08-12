ALTER TABLE attendance_sessions DROP CONSTRAINT attendance_sessions_status_check;
ALTER TABLE attendance_sessions ADD CONSTRAINT attendance_sessions_status_check
  CHECK (status IN ('draft', 'open', 'closed', 'finalized'));
