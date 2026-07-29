import apiClient, { unwrap } from './client';
import type { Result, PaginationParams } from '../types';

export const getStudentResults = async (studentId: string, params?: PaginationParams) => {
  const res = await apiClient.get(`/results/student/${studentId}`, { params });
  return unwrap<Result[]>(res);
};

export const getCourseResults = async (courseId: string, sessionId: string) => {
  const { data } = await apiClient.get<{ data: Result[] }>(`/results/course/${courseId}/session/${sessionId}`);
  return data.data;
};

export const getResult = async (resultId: string) => {
  const { data } = await apiClient.get<{ data: Result }>(`/results/${resultId}`);
  return data.data;
};

export const enterScore = async (payload: { studentId?: string; courseId: string; sessionId: string; semesterId: string; caScore: number; examScore: number; matricNumber?: string }) => {
  const backendPayload: Record<string, unknown> = {
    course_id: payload.courseId,
    session_id: payload.sessionId,
    semester_id: payload.semesterId,
    ca_score: payload.caScore,
    exam_score: payload.examScore,
  };
  if (payload.studentId) {
    backendPayload.student_id = payload.studentId;
  }
  if (payload.matricNumber) {
    backendPayload.matric_number = payload.matricNumber;
  }
  const { data } = await apiClient.post<{ data: Result }>('/results', backendPayload);
  return data.data;
};

export const updateScore = async (resultId: string, payload: { caScore: number; examScore: number }) => {
  const backendPayload = {
    ca_score: payload.caScore,
    exam_score: payload.examScore,
  };
  const { data } = await apiClient.put<{ data: Result }>(`/results/${resultId}`, backendPayload);
  return data.data;
};

export const approveResult = async (resultId: string) => {
  const { data } = await apiClient.put<{ data: Result }>(`/results/${resultId}/status`, { status: 'approved' });
  return data.data;
};

export const getResultAuditLogs = async (resultId: string) => {
  const { data } = await apiClient.get<{ data: unknown[] }>(`/results/${resultId}/audit-logs`);
  return data.data;
};

export const getAllResults = async (params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: Result[] }>('/results', { params });
  return data.data;
};

export const deleteResult = async (resultId: string) => {
  await apiClient.delete(`/results/${resultId}`);
};
