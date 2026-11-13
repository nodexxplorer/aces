import client, { unwrap } from './client';

export interface AttendanceCourse {
  academic_year?: string;
  is_active?: boolean;
  id: string;
  code: string;
  title: string;
  semester_id: string;
  semester: string;
  can_manage: boolean;
}
export interface VerifiedSession {
  id: string;
  course_id: string;
  semester_id: string;
  lecturer_id: string;
  delegate_id: string | null;
  title: string;
  venue: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'draft' | 'open' | 'closed' | 'finalized' | 'cancelled';
  closes_at: string | null;
  revision: number;
}
export interface VerifiedRecord {
  user_id: string;
  name: string;
  matric: string;
  verification: string;
  outcome: string;
  flags: string[];
  submitted_at: string | null;
  revision: number;
  review_reason: string | null;
}
export interface AttendanceDispute {
  id: string;
  user_id: string;
  reason: string;
  status: string;
  resolution: string | null;
}
export interface AttendanceEvent {
  id: string;
  action: string;
  actor_id: string;
  created_at: string;
  evidence: unknown;
}
export interface AttendanceDetail {
  courseCode?: string;
  delegates?: { id: string; name: string; matric: string }[];
  session: VerifiedSession;
  canManage: boolean;
  canOperate: boolean;
  records: VerifiedRecord[];
  disputes: AttendanceDispute[];
  events: AttendanceEvent[];
}
export interface EligibilityResult {
  user_id: string;
  name: string;
  matric: string;
  credited: number;
  total: number;
  pending: number;
  percentage: number | null;
  decision: 'eligible' | 'not_eligible' | 'pending_review' | 'not_assessable';
}
export interface EligibilityReport {
  policyVersion: string;
  threshold: number;
  pilot: boolean;
  results: EligibilityResult[];
}
export interface EligibilitySnapshot {
  id: string;
  version: number;
  policy_version: string;
  created_at: string;
  results: EligibilityResult[];
  basis: unknown;
}
export interface AttendanceLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}
const root = '/verified-attendance';
export const attendanceCatalog = () =>
  client.get(`${root}/catalog`).then(unwrap<{ courses: AttendanceCourse[]; policyVersion: string }>);
export const attendanceSessions = (course: string, semester: string) =>
  client.get(`${root}/sessions`, { params: { course, semester } }).then(unwrap<VerifiedSession[]>);
export const attendanceDetail = (id: string) => client.get(`${root}/sessions/${id}`).then(unwrap<AttendanceDetail>);
export const createVerifiedSession = (input: {
  courseId: string;
  semesterId: string;
  title: string;
  venue: string;
  scheduledAt: string;
  durationMinutes: number;
  radiusM: number;
  latitude: number | null;
  longitude: number | null;
}) => client.post(`${root}/sessions`, input).then(unwrap<{ id: string }>);
export const attendanceAction = (id: string, action: string, input: object = {}) =>
  client.post(`${root}/sessions/${id}/${action}`, input).then(unwrap);
export const attendanceCode = (id: string) =>
  client.get(`${root}/sessions/${id}/code`).then(unwrap<{ challenge: string; expiresAt: string; serverTime: string }>);
export const attendanceEligibility = (course: string, semester: string) =>
  client.get(`${root}/courses/${course}/${semester}/eligibility`).then(unwrap<EligibilityReport>);
export const attendanceSnapshots = (course: string, semester: string) =>
  client.get(`${root}/courses/${course}/${semester}/snapshots`).then(unwrap<EligibilitySnapshot[]>);
export const publishAttendanceSnapshot = (course: string, semester: string) =>
  client.post(`${root}/courses/${course}/${semester}/snapshots`, {}).then(unwrap<EligibilitySnapshot>);
export const submitVerifiedAttendance = (
  id: string,
  challenge: string,
  device: string,
  location: AttendanceLocation | null,
) => client.post(`${root}/sessions/${id}/checkin`, { challenge, device, location }).then(unwrap<VerifiedRecord>);

// This is a revocable browser credential, NOT a hardware identifier. The
// server flags first registration/replacement for supervised verification.
export function attendanceDevice(): string {
  const key = 'aces-attendance-device-v1';
  let credential = localStorage.getItem(key);
  if (!credential) {
    credential = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, '0')).join(
      '',
    );
    localStorage.setItem(key, credential);
  }
  return credential;
}
export function attendanceLocation(): Promise<AttendanceLocation | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          capturedAt: new Date(p.timestamp).toISOString(),
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}
