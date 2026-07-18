import apiClient, { unwrap } from './client';
import type { Session, SemesterEntry } from '../types';

export const getSessions = async (params?: { page?: number; perPage?: number }) => {
  const res = await apiClient.get('/sessions', {
    params: {
      page_id: params?.page || 1,
      page_size: params?.perPage || 100,
    },
  });
  return unwrap<Session[]>(res);
};

export const getSession = async (sessionId: string) => {
  const res = await apiClient.get(`/sessions/${sessionId}`);
  return unwrap<Session>(res);
};

export const createSession = async (payload: { name: string; start_date?: string; end_date?: string }) => {
  const res = await apiClient.post('/sessions', payload);
  return unwrap<Session>(res);
};

export const updateSession = async (sessionId: string, payload: Partial<Session>) => {
  const res = await apiClient.put(`/sessions/${sessionId}`, payload);
  return unwrap<Session>(res);
};

export const deleteSession = async (sessionId: string) => {
  await apiClient.delete(`/sessions/${sessionId}`);
};

// ─── Semesters ───

export const listSessionSemesters = async (sessionId: string) => {
  const res = await apiClient.get(`/semesters/session/${sessionId}`);
  return unwrap<SemesterEntry[]>(res);
};

export const getSemester = async (semesterId: string) => {
  const res = await apiClient.get(`/semesters/${semesterId}`);
  return unwrap<SemesterEntry>(res);
};

export const createSemester = async (payload: {
  session_id: string;
  name: 'harmattan' | 'rain';
  start_date?: string;
  end_date?: string;
  registration_deadline?: string;
}) => {
  const res = await apiClient.post('/semesters', payload);
  return unwrap<SemesterEntry>(res);
};

export const updateSemester = async (semesterId: string, payload: Partial<SemesterEntry>) => {
  const res = await apiClient.put(`/semesters/${semesterId}`, payload);
  return unwrap<SemesterEntry>(res);
};

export const deleteSemester = async (semesterId: string) => {
  await apiClient.delete(`/semesters/${semesterId}`);
};
