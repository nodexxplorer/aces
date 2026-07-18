import apiClient from './client';
import type { AppNotification } from '../types';

export const getNotifications = async (userId: string) => {
  const { data } = await apiClient.get<{ data: AppNotification[] }>(`/notifications/user/${userId}`);
  return data.data;
};

export const markAsRead = async (notificationId: string) => {
  const { data } = await apiClient.put<{ data: AppNotification }>(`/notifications/${notificationId}/read`);
  return data.data;
};

export const markAllAsRead = async (userId: string) => {
  await apiClient.post(`/notifications/user/${userId}/mark-all-read`);
};

export const deleteNotification = async (notificationId: string) => {
  await apiClient.delete(`/notifications/${notificationId}`);
};

export const createNotification = async (payload: { userId: string; title: string; message: string; type: string }) => {
  const { data } = await apiClient.post<{ data: AppNotification }>('/notifications', payload);
  return data.data;
};
