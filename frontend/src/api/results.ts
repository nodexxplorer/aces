import apiClient from './client';
import type { Result, ResultSummary, PaginationParams, PaginatedResponse } from '../types';

export const getMyResults = async (params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: ResultSummary[] }>('/results/my', { params });
  return data.data;
};

export const getResultsByCourse = async (courseId: string) => {
  const { data } = await apiClient.get<{ data: Result[] }>(`/results/course/${courseId}`);
  return data.data;
};

export const getResultsBySession = async (sessionId: string, semester?: string) => {
  const { data } = await apiClient.get<{ data: Result[] }>(`/results/session/${sessionId}`, { params: { semester } });
  return data.data;
};

export const getAllResults = async (params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Result> }>('/results', { params });
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
  const { data } = await apiClient.post<{ data: Result }>(`/results/${resultId}/approve`);
  return data.data;
};

export const bulkUploadResults = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<{ data: { imported: number; failed: number } }>('/results/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};
