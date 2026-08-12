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
  // page_id/page_size are binding:"required" server-side with no defaults —
  // AcademicsHubPage's TranscriptsTab calls this with no arguments at all,
  // which sent an empty query string and 400'd on every load.
  const res = await apiClient.get('/transcript-requests/pending', {
    params: {
      page_id: params?.page || 1,
      page_size: Math.min(params?.perPage || 50, 100),
    },
  });
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
