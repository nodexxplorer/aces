import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import apiClient, { unwrap } from './client';

// Mirrors frontend/src/api/class-rep.ts (web) closely — same backend
// endpoints, same shapes, trimmed to what the mobile class-rep attendance
// flow needs.

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

export interface TimetableEntry {
  timetable_entry_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  lecturer_name: string;
  venue: string;
  // 1=Monday..7=Sunday, or null.
  day_of_week: number | null;
  // Raw TIMESTAMPTZ text (e.g. "2026-08-17 08:00:00+00") — only the
  // time-of-day portion is meaningful.
  start_time: string;
  end_time: string;
  card_status: 'upcoming' | 'ongoing' | 'past' | 'cancelled';
  attendance_session_id?: string;
  attendance_status?: string;
}

export interface RegisteredStudentAttendance {
  student_id: string;
  user_id: string;
  matric_number: string;
  full_name: string;
  level: number;
  profile_picture_url?: string;
  registration_status: string;
  registered_at: string;
}

export const getClassRepTimetable = async () => {
  const res = await apiClient.get<{ entries: TimetableEntry[]; level: number }>('/class-rep/timetable');
  return res.data;
};

export const getRegisteredStudentsForAttendance = async (courseId: string) => {
  const res = await apiClient.get<{ students: RegisteredStudentAttendance[]; total_registered: number }>(
    `/attendance/registered-students/${courseId}`,
  );
  return res.data;
};

export const createAttendanceSession = async (courseId: string, method: string, venue?: string) => {
  const res = await apiClient.post('/class-rep/attendance-sessions', {
    course_id: courseId,
    method,
    venue: venue || null,
  });
  return unwrap<AttendanceSession>(res);
};

export const openAttendanceSession = async (sessionId: string) => {
  const res = await apiClient.put(`/class-rep/attendance-sessions/${sessionId}/open`);
  return unwrap<AttendanceSession>(res);
};

export const closeAttendanceSession = async (sessionId: string) => {
  const res = await apiClient.put(`/class-rep/attendance-sessions/${sessionId}/close`);
  return unwrap<AttendanceSession>(res);
};

export const listMyAttendanceSessions = async () => {
  const res = await apiClient.get('/class-rep/attendance-sessions/mine');
  return unwrap<AttendanceSession[]>(res);
};

export const listAttendanceCheckins = async (sessionId: string) => {
  const res = await apiClient.get(`/class-rep/attendance-sessions/${sessionId}/checkins`);
  return unwrap<AttendanceCheckin[]>(res);
};

export const checkInStudent = async (
  sessionId: string,
  studentId: string,
  method = 'manual',
  present = true,
  remark?: string,
) => {
  const res = await apiClient.post('/class-rep/checkin', {
    session_id: sessionId,
    student_id: studentId,
    method,
    present,
    remark: remark || null,
  });
  return unwrap<AttendanceCheckin>(res);
};

export const submitAttendanceSession = async (sessionId: string, notes?: string) => {
  const res = await apiClient.post<{ status: string; attendance_status: string }>(
    `/attendance/sessions/${sessionId}/submit`,
    { action: 'send_to_lecturer', notes },
  );
  return res.data;
};

// Fetches the backend-generated branded attendance-sheet PDF and hands it to
// the OS share sheet — same pattern as src/utils/calendar.ts's shareICS.
export const downloadAttendancePDF = async (sessionId: string) => {
  if (Platform.OS === 'web') {
    Alert.alert('Not Supported', 'Downloading the PDF from the web preview is not supported — use the mobile app.');
    return;
  }

  const res = await apiClient.get<ArrayBuffer>(`/attendance/sessions/${sessionId}/pdf`, {
    responseType: 'arraybuffer',
  });

  const file = new File(Paths.cache, `attendance-${sessionId}.pdf`);
  file.create({ overwrite: true });
  file.write(new Uint8Array(res.data));

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert('Not Supported', "Your device doesn't support sharing files.");
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Attendance Sheet' });
};

// ─── Class list, pending registrations, notices ─────────────────────────────
// Mirrors frontend/src/api/class-rep.ts and api/additional-features.ts (web).

export interface ClassRepStudent {
  id: string;
  user_id?: string;
  full_name: string;
  matric_number: string;
  email: string;
  level: number;
  is_defaulter: boolean;
}

export const getClassRepClassList = async () => {
  const res = await apiClient.get('/class-rep/class-list');
  return unwrap<ClassRepStudent[]>(res);
};

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

export const listPendingCourseRegistrations = async () => {
  const res = await apiClient.get('/class-rep/pending-registrations');
  return unwrap<PendingCourseRegistration[]>(res);
};

export const approveCourseRegistration = async (registrationId: string) => {
  await apiClient.put(`/course-registrations/${registrationId}`, { status: 'approved' });
};

export interface PendingStudentRegistration {
  id: string;
  user_id: string;
  full_name: string;
  matric_number: string;
  email: string;
  level: number;
  type: 'signup' | 'account';
  created_at?: string;
}

export const listPendingStudentRegistrations = async () => {
  const res = await apiClient.get('/class-rep/pending-student-registrations');
  return unwrap<PendingStudentRegistration[]>(res);
};

export const approveStudentRegistration = async (id: string) => {
  await apiClient.post(`/class-rep/pending-student-registrations/${id}/approve`);
};

export const createClassNotice = async (data: {
  title: string;
  content: string;
  is_pinned?: boolean;
  target_user_ids?: string[];
}) => {
  const res = await apiClient.post('/class-notices', data);
  return res.data;
};
