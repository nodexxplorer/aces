import apiClient, { unwrap } from './client';
import type { TimetableEntry, TimetableConflict } from '../types';

export interface ListTimetableParams {
  entryType?: 'class' | 'exam';
  level?: number;
}

export const getTimetable = async (params?: ListTimetableParams) => {
  const res = await apiClient.get('/timetable', { params });
  return unwrap<TimetableEntry[]>(res);
};

export const getTimetableEntry = async (entryId: string) => {
  const res = await apiClient.get(`/timetable/${entryId}`);
  return unwrap<TimetableEntry>(res);
};

export const createTimetableEntry = async (payload: {
  courseId: string;
  dayOfWeek?: number;
  startTime: string;
  endTime: string;
  venue: string;
  level?: number;
  entryType: 'class' | 'exam';
  classType?: string;
  examType?: string;
  lecturerId?: string;
  invigilators?: string;
  examDate?: string;
  sessionId?: string;
  semesterId?: string;
}) => {
  const res = await apiClient.post('/timetable', payload);
  return unwrap<TimetableEntry>(res);
};

export const updateTimetableEntry = async (entryId: string, payload: {
  courseId: string;
  dayOfWeek?: number;
  startTime: string;
  endTime: string;
  venue: string;
  level?: number;
  entryType: 'class' | 'exam';
  classType?: string;
  examType?: string;
  lecturerId?: string;
  invigilators?: string;
}) => {
  const res = await apiClient.put(`/timetable/${entryId}`, payload);
  return unwrap<TimetableEntry>(res);
};

export const deleteTimetableEntry = async (entryId: string) => {
  await apiClient.delete(`/timetable/${entryId}`);
};

export const checkTimetableConflicts = async (entryType: string, level?: number) => {
  const params: Record<string, string | number> = { entryType };
  if (level) params.level = level;
  const res = await apiClient.get('/timetable/conflicts', { params });
  return unwrap<{ conflict_count: number; conflicts: TimetableConflict[] }>(res);
};

export const publishTimetable = async (entryType: 'class' | 'exam', publish: boolean) => {
  const res = await apiClient.post('/timetable/publish', { entry_type: entryType, publish });
  return res.data;
};

export const bulkDeleteTimetable = async (entryType: string, level?: number) => {
  const params: Record<string, string> = { entryType };
  if (level) params.level = String(level);
  const res = await apiClient.delete('/timetable/bulk', { params });
  return res.data;
};

// Aliases for backward compat
export const getTimetableSlots = getTimetable;
export const createTimetableSlot = createTimetableEntry;
