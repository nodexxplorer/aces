import apiClient from './client';
import type { Complaint, PaginationParams, PaginatedResponse } from '../types';

export const submitComplaint = async (payload: Pick<Complaint, 'subject' | 'description' | 'category' | 'priority'>) => {
  const { data } = await apiClient.post<{ data: Complaint }>('/complaints', payload);
  return data.data;
};

export const getMyComplaints = async () => {
  const { data } = await apiClient.get<{ data: Complaint[] }>('/complaints/my');
  return data.data;
};

export const getAllComplaints = async (params?: PaginationParams & { status?: string; priority?: string }) => {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Complaint> }>('/complaints', { params });
  return data.data;
};

export const assignComplaint = async (complaintId: string, assignedTo: string) => {
  const { data } = await apiClient.post<{ data: Complaint }>(`/complaints/${complaintId}/assign`, { assignedTo });
  return data.data;
};

export const resolveComplaint = async (complaintId: string, resolution: string) => {
  const { data } = await apiClient.post<{ data: Complaint }>(`/complaints/${complaintId}/resolve`, { resolution });
  return data.data;
};
