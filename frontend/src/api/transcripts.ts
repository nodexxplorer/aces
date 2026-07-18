import apiClient from './client';
import type { TranscriptRequest, PaginationParams } from '../types';

export const requestTranscript = async (payload: { destination?: string }) => {
  const { data } = await apiClient.post<{ data: TranscriptRequest }>('/transcript-requests', payload);
  return data.data;
};

export const getStudentTranscriptRequests = async (studentId: string) => {
  const { data } = await apiClient.get<{ data: TranscriptRequest[] }>(`/transcript-requests/student/${studentId}`);
  return data.data;
};

export const getPendingTranscriptRequests = async (params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: TranscriptRequest[] }>('/transcript-requests/pending', { params });
  return data.data;
};

export const getTranscriptRequest = async (requestId: string) => {
  const { data } = await apiClient.get<{ data: TranscriptRequest }>(`/transcript-requests/${requestId}`);
  return data.data;
};

export const updateTranscriptStatus = async (requestId: string, status: string) => {
  const { data } = await apiClient.put<{ data: TranscriptRequest }>(`/transcript-requests/${requestId}`, { status });
  return data.data;
};

export const deleteTranscriptRequest = async (requestId: string) => {
  await apiClient.delete(`/transcript-requests/${requestId}`);
};

export const getTranscriptRequests = getPendingTranscriptRequests;
export const approveTranscriptRequest = async (requestId: string) => {
  return updateTranscriptStatus(requestId, 'approved');
};
export const markTranscriptPrinted = async (requestId: string) => {
  return updateTranscriptStatus(requestId, 'printed');
};

