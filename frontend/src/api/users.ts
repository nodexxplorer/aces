import apiClient from './client';
import type { User, PaginationParams, PaginatedResponse } from '../types';

export const getUsers = async (params?: PaginationParams & { role?: string; accountType?: string }) => {
  const { data } = await apiClient.get<{ data: PaginatedResponse<User> }>('/users', { params });
  return data.data;
};

export const getUser = async (userId: string) => {
  const { data } = await apiClient.get<{ data: User }>(`/users/${userId}`);
  return data.data;
};

export const updateUser = async (userId: string, payload: Partial<User>) => {
  const { data } = await apiClient.put<{ data: User }>(`/users/${userId}`, payload);
  return data.data;
};

export const deleteUser = async (userId: string) => {
  await apiClient.delete(`/users/${userId}`);
};

export const approveUser = async (userId: string) => {
  const { data } = await apiClient.post<{ data: User }>(`/users/${userId}/approve`);
  return data.data;
};

export const rejectUser = async (userId: string, reason: string) => {
  const { data } = await apiClient.post<{ data: User }>(`/users/${userId}/reject`, { reason });
  return data.data;
};

export const getPendingApprovals = async () => {
  const { data } = await apiClient.get<{ data: User[] }>('/users/pending-approvals');
  return data.data;
};
