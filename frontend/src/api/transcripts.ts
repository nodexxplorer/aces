import apiClient from './client';
import type { TranscriptRequest, PaginationParams, PaginatedResponse } from '../types';

export const requestTranscript = async (payload: { destination?: string }) => {
  const { data } = await apiClient.post<{ data: TranscriptRequest }>('/transcripts/request', payload);
  return data.data;
};

export const getMyTranscriptRequests = async () => {
  const { data } = await apiClient.get<{ data: TranscriptRequest[] }>('/transcripts/my');
  return data.data;
};

export const getAllTranscriptRequests = async (params?: PaginationParams & { status?: string }) => {
  const { data } = await apiClient.get<{ data: PaginatedResponse<TranscriptRequest> }>('/transcripts', { params });
  return data.data;
};

export const updateTranscriptStatus = async (requestId: string, status: string) => {
  const { data } = await apiClient.put<{ data: TranscriptRequest }>(`/transcripts/${requestId}/status`, { status });
  return data.data;
};

export const downloadUnofficialTranscript = async () => {
  const { data } = await apiClient.get('/transcripts/download/unofficial', { responseType: 'blob' });
  return data as Blob;
};
