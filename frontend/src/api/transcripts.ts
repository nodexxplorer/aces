import apiClient, { unwrap } from './client';
import type { TranscriptRequest, PaginationParams } from '../types';

export const requestTranscript = async (payload: { destination?: string }) => {
  const res = await apiClient.post('/transcript-requests', payload);
  return unwrap<TranscriptRequest>(res);
};

export const getStudentTranscriptRequests = async (studentId: string) => {
  const res = await apiClient.get(`/transcript-requests/student/${studentId}`);
  return unwrap<TranscriptRequest[]>(res);
};

export const getPendingTranscriptRequests = async (params?: PaginationParams) => {
  const res = await apiClient.get('/transcript-requests/pending', { params });
  return unwrap<TranscriptRequest[]>(res);
};

export const getTranscriptRequest = async (requestId: string) => {
  const res = await apiClient.get(`/transcript-requests/${requestId}`);
  return unwrap<TranscriptRequest>(res);
};

export const updateTranscriptStatus = async (requestId: string, status: string) => {
  const res = await apiClient.put(`/transcript-requests/${requestId}`, { status });
  return unwrap<TranscriptRequest>(res);
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
