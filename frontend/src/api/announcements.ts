import apiClient, { unwrap } from './client';
import type { Announcement } from '../types';

export const getAnnouncements = async (params?: { limit?: number; offset?: number }) => {
  const res = await apiClient.get('/announcements', {
    params: { limit: params?.limit || 50, offset: params?.offset || 0 },
  });
  return unwrap<Announcement[]>(res);
};

export const getAnnouncement = async (announcementId: string) => {
  const res = await apiClient.get(`/announcements/${announcementId}`);
  return unwrap<Announcement>(res);
};

export const createAnnouncement = async (payload: { title: string; content: string; target_audience?: string[]; target_level?: number; is_pinned?: boolean; expires_at?: string; created_by: string }) => {
  const res = await apiClient.post('/announcements', payload);
  return unwrap<Announcement>(res);
};

export const updateAnnouncement = async (announcementId: string, payload: Partial<Announcement>) => {
  const res = await apiClient.put(`/announcements/${announcementId}`, payload);
  return unwrap<Announcement>(res);
};

export const deleteAnnouncement = async (announcementId: string) => {
  await apiClient.delete(`/announcements/${announcementId}`);
};
