import apiClient from './client';
import type { AttendanceRecord, AttendanceSession } from '../types';

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
