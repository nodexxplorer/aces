import apiClient from './client';
import type { Result, PaginationParams } from '../types';

export const getStudentResults = async (studentId: string, params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: Result[] }>(`/results/student/${studentId}`, { params });
  return data.data;
};

export const getCourseResults = async (courseId: string, sessionId: string) => {
  const { data } = await apiClient.get<{ data: Result[] }>(`/results/course/${courseId}/session/${sessionId}`);
  return data.data;
};

export const getResult = async (resultId: string) => {
  const { data } = await apiClient.get<{ data: Result }>(`/results/${resultId}`);
  return data.data;
};

export const enterScore = async (payload: { studentId: string; courseId: string; sessionId: string; semester: string; caScore: number; examScore: number }) => {
  const { data } = await apiClient.post<{ data: Result }>('/results', payload);
  return data.data;
};

export const updateScore = async (resultId: string, payload: { caScore: number; examScore: number }) => {
  const { data } = await apiClient.put<{ data: Result }>(`/results/${resultId}`, payload);
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

