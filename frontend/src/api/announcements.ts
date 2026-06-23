import apiClient from './client';
import type { Announcement, PaginationParams, PaginatedResponse } from '../types';

export const getAnnouncements = async (params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Announcement> }>('/announcements', { params });
  return data.data;
};

export const getMyAnnouncements = async () => {
  const { data } = await apiClient.get<{ data: Announcement[] }>('/announcements/my');
  return data.data;
};

export const createAnnouncement = async (payload: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data } = await apiClient.post<{ data: Announcement }>('/announcements', payload);
  return data.data;
};

export const updateAnnouncement = async (announcementId: string, payload: Partial<Announcement>) => {
  const { data } = await apiClient.put<{ data: Announcement }>(`/announcements/${announcementId}`, payload);
  return data.data;
};

export const deleteAnnouncement = async (announcementId: string) => {
  await apiClient.delete(`/announcements/${announcementId}`);
};

export const pinAnnouncement = async (announcementId: string) => {
  const { data } = await apiClient.post<{ data: Announcement }>(`/announcements/${announcementId}/pin`);
  return data.data;
};
