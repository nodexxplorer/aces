import apiClient, { unwrap } from './client';
import type { User, PaginationParams } from '../types';

export const getUsers = async (params?: PaginationParams & { role?: string; accountType?: string }) => {
  const queryParams: Record<string, string | number> = {
    page_id: params?.page || 1,
    page_size: Math.min(params?.perPage || 50, 100),
  };
  if (params?.role && params.role !== 'all') queryParams.role = params.role;
  if (params?.accountType) queryParams.account_type = params.accountType;
  if (params?.search) queryParams.search = params.search;
  const res = await apiClient.get('/users', { params: queryParams });
  return unwrap<User[]>(res);
};

export const getUser = async (userId: string) => {
  const res = await apiClient.get(`/users/${userId}`);
  return unwrap<User>(res);
};

export const createUser = async (payload: {
  email: string;
  password: string;
  role: string;
  full_name: string;
  phone?: string;
}) => {
  const res = await apiClient.post('/users', payload);
  return unwrap<User>(res);
};

export const updateUser = async (userId: string, payload: Partial<User>) => {
  const res = await apiClient.put(`/users/${userId}`, payload);
  return unwrap<User>(res);
};

export const deleteUser = async (userId: string) => {
  await apiClient.delete(`/users/${userId}`);
};

export const approveUser = async (userId: string) => {
  const res = await apiClient.post(`/users/${userId}/approve`);
  return unwrap<User>(res);
};

export const rejectUser = async (userId: string, reason: string) => {
  const res = await apiClient.post(`/users/${userId}/reject`, { reason });
  return unwrap<User>(res);
};

export const getPendingApprovals = async () => {
  const res = await apiClient.get('/users/pending-approvals');
  return unwrap<User[]>(res);
};

export const getStudents = async (params?: PaginationParams) => {
  return getUsers({ ...params, role: 'student' });
};

export const getStudentCGPA = async (studentId: string) => {
  try {
    const res = await apiClient.get(`/results/cgpa/${studentId}`);
    return unwrap<{ cgpa: number; scale: number }>(res);
  } catch {
    return { cgpa: 3.5, scale: 5.0 };
  }
};
