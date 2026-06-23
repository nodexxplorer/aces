import apiClient from './client';
import type { User, UserRole } from '../types';

export const promoteUser = async (userId: string, role: UserRole) => {
  const { data } = await apiClient.post<{ data: User }>(`/roles/promote/${userId}`, { role });
  return data.data;
};

export const demoteUser = async (userId: string, role: UserRole) => {
  const { data } = await apiClient.post<{ data: User }>(`/roles/demote/${userId}`, { role });
  return data.data;
};

export const delegateAdmin = async (userId: string) => {
  const { data } = await apiClient.post<{ data: User }>(`/roles/delegate/${userId}`);
  return data.data;
};

export const revokeAdmin = async (userId: string) => {
  const { data } = await apiClient.post<{ data: User }>(`/roles/revoke-admin/${userId}`);
  return data.data;
};

export const getUserRoles = async (userId: string) => {
  const { data } = await apiClient.get<{ data: UserRole[] }>(`/roles/user/${userId}`);
  return data.data;
};
