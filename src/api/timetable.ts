import apiClient from './client';
import type { TimetableEntry } from '../types';

export const getTimetable = async (params?: { level?: number; semester?: string; sessionId?: string }) => {
  const { data } = await apiClient.get<{ data: TimetableEntry[] }>('/timetable', { params });
  return data.data;
};

export const getMyTimetable = async () => {
  const { data } = await apiClient.get<{ data: TimetableEntry[] }>('/timetable/my');
  return data.data;
};

export const createTimetableEntry = async (payload: Omit<TimetableEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data } = await apiClient.post<{ data: TimetableEntry }>('/timetable', payload);
  return data.data;
};

export const updateTimetableEntry = async (entryId: string, payload: Partial<TimetableEntry>) => {
  const { data } = await apiClient.put<{ data: TimetableEntry }>(`/timetable/${entryId}`, payload);
  return data.data;
};

export const deleteTimetableEntry = async (entryId: string) => {
  await apiClient.delete(`/timetable/${entryId}`);
};
