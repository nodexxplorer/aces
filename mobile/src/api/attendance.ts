import apiClient, { unwrap } from './client';

export interface AttendanceCheckin {
  id: string;
  session_id: string;
  student_id: string;
  present: boolean;
  method: string;
  checked_in_at?: string;
}

// The web app's /student/attendance/overview endpoint exists in the backend
// source but was never actually wired to a route — it 404s. The dashboard
// endpoint already computes an equivalent summary (total/attended/rate) from
// a proven, routed path, so Attendance reuses that instead of the dead one.
export const selfCheckIn = async (sessionId: string) => {
  const res = await apiClient.post('/class-rep/checkin', {
    session_id: sessionId,
    // attendance_checkins.method has a DB CHECK constraint allowing only
    // 'qr' | 'manual' | 'digital_sheet' — 'qr_self' isn't one of them and
    // every self-check-in 500'd on the insert until this matched the
    // constraint (self-scanning is still fundamentally a QR check-in).
    method: 'qr',
    present: true,
  });
  return unwrap<AttendanceCheckin>(res);
};
