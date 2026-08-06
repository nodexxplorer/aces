import apiClient, { unwrap } from './client';
import type { Complaint, ComplaintStatus, PaginationParams } from '../types';

export const submitComplaint = async (payload: {
  subject: string;
  description: string;
  category: string;
  priority: string;
}) => {
  const res = await apiClient.post('/complaints', payload);
  return unwrap<Complaint>(res);
};

export const getAllComplaints = async (params?: PaginationParams & { status?: string; priority?: string }) => {
  const res = await apiClient.get('/complaints', { params });
  return unwrap<Complaint[]>(res);
};

export const getMyComplaints = async () => {
  const res = await apiClient.get('/complaints/my');
  return unwrap<Complaint[]>(res);
};

export const getComplaint = async (complaintId: string) => {
  const res = await apiClient.get(`/complaints/${complaintId}`);
  return unwrap<Complaint>(res);
};

export const updateComplaint = async (complaintId: string, payload: Partial<Complaint>) => {
  const res = await apiClient.put(`/complaints/${complaintId}`, payload);
  return unwrap<Complaint>(res);
};

export const deleteComplaint = async (complaintId: string) => {
  await apiClient.delete(`/complaints/${complaintId}`);
};

export const assignComplaint = async (complaintId: string, assignedTo: string) => {
  const res = await apiClient.post(`/complaints/${complaintId}/assign`, { assignedTo });
  return unwrap<Complaint>(res);
};

export const resolveComplaint = async (complaintId: string, resolution: string) => {
  const res = await apiClient.post(`/complaints/${complaintId}/resolve`, { resolution });
  return unwrap<Complaint>(res);
};

export interface ComplaintStatusHistoryEntry {
  id: string;
  complaint_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  changed_by_role: string;
  note: string | null;
  created_at: string;
}

export const getComplaintHistory = async (complaintId: string) => {
  const res = await apiClient.get(`/complaints/${complaintId}/history`);
  return unwrap<ComplaintStatusHistoryEntry[]>(res);
};

// Aliases for admin pages compatibility
export const getComplaints = getAllComplaints;
export const updateComplaintStatus = async (complaintId: string, status: ComplaintStatus) => {
  return updateComplaint(complaintId, { status });
};
