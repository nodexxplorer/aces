import apiClient, { unwrap } from './client';
import type { Result, PaginationParams } from '../types';

export const getStudentResults = async (studentId: string, params?: PaginationParams) => {
  const res = await apiClient.get(`/results/student/${studentId}`, { params });
  return unwrap<Result[]>(res);
};

// A single semester's results as a branded PDF — distinct from the full
// transcript request/approval flow, for things like scholarship applications.
export const getResultSlipDownloadUrl = (sessionId: string, semesterId: string) => {
  const base = apiClient.defaults.baseURL || '';
  return `${base}/results/slip?session_id=${sessionId}&semester_id=${semesterId}`;
};

export const getCourseResults = async (courseId: string, sessionId: string) => {
  const res = await apiClient.get(`/results/course/${courseId}/session/${sessionId}`);
  return unwrap<Result[]>(res);
};

export const getResult = async (resultId: string) => {
  const res = await apiClient.get(`/results/${resultId}`);
  return unwrap<Result>(res);
};

export const enterScore = async (payload: {
  studentId?: string;
  courseId: string;
  sessionId: string;
  semesterId: string;
  caScore: number;
  examScore: number;
  matricNumber?: string;
}) => {
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
  const res = await apiClient.post('/results', backendPayload);
  return unwrap<Result>(res);
};

export const updateScore = async (resultId: string, payload: { caScore: number; examScore: number }) => {
  const backendPayload = {
    ca_score: payload.caScore,
    exam_score: payload.examScore,
  };
  const res = await apiClient.put(`/results/${resultId}`, backendPayload);
  return unwrap<Result>(res);
};

export const approveResult = async (resultId: string) => {
  const res = await apiClient.put(`/results/${resultId}/status`, { status: 'approved' });
  return unwrap<Result>(res);
};

export const getResultAuditLogs = async (resultId: string) => {
  const res = await apiClient.get(`/results/${resultId}/audit-logs`);
  return unwrap<unknown[]>(res);
};

export const getAllResults = async (params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: Result[] }>('/results', { params });
  return data.data;
};

export const deleteResult = async (resultId: string) => {
  await apiClient.delete(`/results/${resultId}`);
};
