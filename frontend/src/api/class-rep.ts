import apiClient, { unwrap } from './client';
import { getErrorMessage } from '../utils/errors';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClassRepStudent {
  id: string;
  user_id?: string;
  full_name: string;
  matric_number: string;
  email: string;
  level: number;
  is_defaulter: boolean;
}

export interface ClassRepAssignment {
  id: string;
  class_rep_id: string;
  full_name: string;
  level: number;
  academic_year: string;
  appointment_type: string;
  consecutive_terms: number;
}

export interface AttendanceSession {
  id: string;
  course_id: string;
  class_rep_id: string;
  method: string;
  venue: string | null;
  status: string;
  total_present: number;
  total_absent: number;
  total_students: number;
  created_at: string;
  started_at: string | null;
  closed_at: string | null;
}

export interface AttendanceCheckin {
  id: string;
  session_id: string;
  student_id: string;
  method: string;
  present: boolean;
  remark: string | null;
  checked_in_at: string;
  student_name: string;
  matric_number: string;
}

export interface ClassRepReport {
  id: string;
  class_rep_id: string;
  report_type: string;
  title: string;
  content: string;
  level: number;
  academic_year: string | null;
  status: string;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  class_rep_name?: string;
}

export interface PerformanceReview {
  id: string;
  class_rep_id: string;
  reviewed_by: string;
  academic_year: string;
  term: string;
  attendance_rate: number;
  reports_submitted: number;
  responsiveness_score: number | null;
  comments: string | null;
  rating: string | null;
  created_at: string;
}

// ─── Class List ──────────────────────────────────────────────────────────────

export async function getClassRepClassList(): Promise<ClassRepStudent[]> {
  const res = await apiClient.get('/class-rep/class-list');
  return unwrap<ClassRepStudent[]>(res);
}

// ─── Pending Course Registrations ───────────────────────────────────────────

export interface PendingCourseRegistration {
  id: string;
  student_id: string;
  student_name: string;
  matric_number: string;
  level: number;
  session_id: string;
  status: string;
  courses_count: number;
  created_at: string;
}

export async function listPendingCourseRegistrations(): Promise<PendingCourseRegistration[]> {
  const res = await apiClient.get('/class-rep/pending-registrations');
  return unwrap<PendingCourseRegistration[]>(res);
}

export async function approveCourseRegistration(registrationId: string): Promise<void> {
  await apiClient.put(`/course-registrations/${registrationId}`, { status: 'approved' });
}

// ─── Class Rep Assignments ───────────────────────────────────────────────────

export async function listClassReps(): Promise<ClassRepAssignment[]> {
  const res = await apiClient.get('/class-rep/list');
  return unwrap<ClassRepAssignment[]>(res);
}

export async function appointClassRep(classRepId: string, level: number, academicYear: string): Promise<void> {
  await apiClient.post('/class-rep/appoint', {
    class_rep_id: classRepId,
    level,
    academic_year: academicYear,
  });
}

export async function deactivateClassRep(assignmentId: string): Promise<void> {
  await apiClient.delete(`/class-rep/${assignmentId}`);
}

// ─── Attendance Sessions ─────────────────────────────────────────────────────

export async function createAttendanceSession(
  courseId: string,
  method: string,
  venue?: string,
): Promise<AttendanceSession> {
  const res = await apiClient.post('/class-rep/attendance-sessions', {
    course_id: courseId,
    method,
    venue: venue || null,
  });
  return unwrap<AttendanceSession>(res);
}

export async function openAttendanceSession(sessionId: string): Promise<AttendanceSession> {
  const res = await apiClient.put(`/class-rep/attendance-sessions/${sessionId}/open`);
  return unwrap<AttendanceSession>(res);
}

export async function closeAttendanceSession(sessionId: string): Promise<AttendanceSession> {
  const res = await apiClient.put(`/class-rep/attendance-sessions/${sessionId}/close`);
  return unwrap<AttendanceSession>(res);
}

export async function listMyAttendanceSessions(): Promise<AttendanceSession[]> {
  const res = await apiClient.get('/class-rep/attendance-sessions/mine');
  return unwrap<AttendanceSession[]>(res);
}

export async function listAttendanceCheckins(sessionId: string): Promise<AttendanceCheckin[]> {
  const res = await apiClient.get(`/class-rep/attendance-sessions/${sessionId}/checkins`);
  return unwrap<AttendanceCheckin[]>(res);
}

export async function checkInStudent(
  sessionId: string,
  studentId: string,
  method?: string,
  present?: boolean,
  remark?: string,
): Promise<AttendanceCheckin> {
  const res = await apiClient.post('/class-rep/checkin', {
    session_id: sessionId,
    student_id: studentId,
    method: method || 'manual',
    present: present !== undefined ? present : true,
    remark: remark || null,
  });
  return unwrap<AttendanceCheckin>(res);
}

// A student checking themselves in via the QR a class rep displays — the
// backend derives the student's own ID from their session, so no student_id
// is sent (the frontend has no reliable way to know its own students.id).
export async function selfCheckIn(sessionId: string): Promise<AttendanceCheckin> {
  const res = await apiClient.post('/class-rep/checkin', {
    session_id: sessionId,
    method: 'qr_self',
    present: true,
  });
  return unwrap<AttendanceCheckin>(res);
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function submitClassRepReport(
  reportType: string,
  title: string,
  content: string,
  level?: number,
  academicYear?: string,
): Promise<ClassRepReport> {
  const res = await apiClient.post('/class-rep/reports', {
    report_type: reportType,
    title,
    content,
    level: level || 0,
    academic_year: academicYear || '',
  });
  return unwrap<ClassRepReport>(res);
}

export async function listMyReports(status?: string): Promise<ClassRepReport[]> {
  const params = status ? `?status=${status}` : '';
  const res = await apiClient.get(`/class-rep/reports${params}`);
  return unwrap<ClassRepReport[]>(res);
}

export async function listAllReports(status?: string): Promise<ClassRepReport[]> {
  const params = status ? `?status=${status}` : '';
  const res = await apiClient.get(`/class-rep/reports/all${params}`);
  return unwrap<ClassRepReport[]>(res);
}

export async function updateReportStatus(reportId: string, status: string, reviewNotes?: string): Promise<void> {
  await apiClient.put(`/class-rep/reports/${reportId}/status`, {
    status,
    review_notes: reviewNotes || '',
  });
}

// ─── Performance Reviews ─────────────────────────────────────────────────────

export async function createPerformanceReview(
  classRepId: string,
  academicYear: string,
  term: string,
  attendanceRate: number,
  reportsSubmitted: number,
  responsivenessScore?: number,
  comments?: string,
  rating?: string,
): Promise<void> {
  await apiClient.post('/class-rep/performance', {
    class_rep_id: classRepId,
    academic_year: academicYear,
    term,
    attendance_rate: attendanceRate,
    reports_submitted: reportsSubmitted,
    responsiveness_score: responsivenessScore || null,
    comments: comments || '',
    rating: rating || '',
  });
}

export async function listPerformanceReviews(classRepId: string): Promise<PerformanceReview[]> {
  const res = await apiClient.get(`/class-rep/performance?class_rep_id=${classRepId}`);
  return unwrap<PerformanceReview[]>(res);
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface SendNotificationResult {
  student_id: string;
  status: 'sent' | 'failed';
  error?: string;
}

export async function sendClassNotification(
  studentIds: string[],
  title: string,
  message: string,
): Promise<SendNotificationResult[]> {
  const results: SendNotificationResult[] = [];
  const batches = studentIds.map(async (userId) => {
    try {
      await apiClient.post('/notifications', {
        user_id: userId,
        type: 'class_rep_broadcast',
        title,
        message,
      });
      results.push({ student_id: userId, status: 'sent' });
    } catch (e: unknown) {
      results.push({ student_id: userId, status: 'failed', error: getErrorMessage(e) });
    }
  });
  await Promise.all(batches);
  return results;
}
