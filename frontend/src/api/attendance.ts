import apiClient from './client';
import type { AttendanceRecord, AttendanceSession } from '../types';

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

export interface TimetableEntry {
  timetable_entry_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  lecturer_name: string;
  venue: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  card_status: 'upcoming' | 'ongoing' | 'past' | 'cancelled';
  attendance_session_id?: string;
  attendance_status?: string;
}

export interface PendingAttendanceReview {
  session_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  scheduled_date: string;
  class_rep_name: string;
  class_rep_matric: string;
  total_present: number;
  total_absent: number;
  total_late: number;
  total_excused: number;
  status: string;
  submitted_at: string;
}

export const createAttendanceSheet = async (payload: { courseId: string; date: string; label?: string }) => {
  const { data } = await apiClient.post<{ data: AttendanceSession }>('/attendance', payload);
  return data.data;
};

export const getAttendanceByCourse = async (courseId: string, sessionId?: string) => {
  const { data } = await apiClient.get<{ data: AttendanceSession[] }>('/attendance/course', { params: { course_id: courseId, session_id: sessionId } });
  return data.data;
};

export const getStudentAttendance = async (studentId: string, courseId?: string) => {
  const { data } = await apiClient.get<{ data: AttendanceRecord[] }>('/attendance/student', { params: { student_id: studentId, course_id: courseId } });
  return data.data;
};

export const getAttendanceSummary = async (courseId: string) => {
  const { data } = await apiClient.get<{ data: { studentId: string; name: string; total: number; present: number; percentage: number }[] }>('/attendance/summary', { params: { course_id: courseId } });
  return data.data;
};

export const updateAttendanceSheet = async (sheetId: string, records: { studentId: string; isPresent: boolean }[]) => {
  const { data } = await apiClient.put<{ data: AttendanceSession }>(`/attendance/${sheetId}`, { records });
  return data.data;
};

export const finalizeAttendanceSheet = async (sheetId: string) => {
  const { data } = await apiClient.post<{ data: AttendanceSession }>(`/attendance/${sheetId}/finalize`);
  return data.data;
};

export const deleteAttendanceSheet = async (sheetId: string) => {
  await apiClient.delete(`/attendance/${sheetId}`);
};

export const getRegisteredStudentsForAttendance = async (courseId: string) => {
  const res = await apiClient.get<{ students: RegisteredStudentAttendance[]; total_registered: number }>(
    `/attendance/registered-students/${courseId}`
  );
  return res.data;
};

export const getClassRepTimetable = async () => {
  const res = await apiClient.get<{ entries: TimetableEntry[]; level: number }>(
    '/class-rep/timetable'
  );
  return res.data;
};

export const submitAttendanceSession = async (sessionId: string, action: 'send_to_lecturer' | 'generate_pdf', notes?: string) => {
  const res = await apiClient.post<{ status: string; attendance_status: string }>(
    `/attendance/sessions/${sessionId}/submit`,
    { action, notes }
  );
  return res.data;
};

export const getLecturerPendingAttendanceReviews = async () => {
  const res = await apiClient.get<{ reviews: PendingAttendanceReview[]; total: number }>(
    '/lecturers/attendance/pending'
  );
  return res.data;
};

export const reviewAttendanceSession = async (sessionId: string, action: 'approve' | 'request_changes' | 'reject', comment?: string) => {
  const res = await apiClient.post<{ status: string; new_status: string }>(
    `/attendance/sessions/${sessionId}/review`,
    { action, comment }
  );
  return res.data;
};

export const getStudentAttendanceOverview = async () => {
  const res = await apiClient.get<{
    summary: {
      total_sessions: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      attendance_rate: number;
    };
  }>('/student/attendance/overview');
  return res.data;
};

export const downloadAttendancePDF = (sessionId: string) => {
  window.open(`${apiClient.defaults.baseURL || '/api/v1'}/attendance/sessions/${sessionId}/pdf`, '_blank');
};
