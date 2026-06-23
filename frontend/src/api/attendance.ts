import apiClient from './client';
import type { AttendanceRecord, AttendanceSession } from '../types';

export const markAttendance = async (courseId: string, records: { studentId: string; isPresent: boolean }[]) => {
  const { data } = await apiClient.post<{ data: AttendanceSession }>('/attendance/mark', { courseId, records });
  return data.data;
};

export const getAttendanceBySession = async (courseId: string, sessionId?: string) => {
  const { data } = await apiClient.get<{ data: AttendanceSession[] }>(`/attendance/course/${courseId}`, { params: { sessionId } });
  return data.data;
};

export const getMyAttendance = async (courseId?: string) => {
  const { data } = await apiClient.get<{ data: AttendanceRecord[] }>('/attendance/my', { params: { courseId } });
  return data.data;
};

export const getAttendanceSummary = async (courseId: string) => {
  const { data } = await apiClient.get<{ data: { studentId: string; name: string; total: number; present: number; percentage: number }[] }>(`/attendance/summary/${courseId}`);
  return data.data;
};
