import apiClient from './client';
import type { AppNotification } from '../types';

export const getNotifications = async () => {
  const { data } = await apiClient.get<{ data: AppNotification[] }>('/notifications');
  return data.data;
};

export const markAsRead = async (notificationId: string) => {
  const { data } = await apiClient.post<{ data: AppNotification }>(`/notifications/${notificationId}/read`);
  return data.data;
};

export const markAllAsRead = async () => {
  await apiClient.post('/notifications/read-all');
};

export const deleteNotification = async (notificationId: string) => {
  await apiClient.delete(`/notifications/${notificationId}`);
};

export const getUnreadCount = async () => {
  const { data } = await apiClient.get<{ data: { count: number } }>('/notifications/unread-count');
  return data.data.count;
};
