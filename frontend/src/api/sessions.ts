import apiClient from './client';
import type { Session } from '../types';

export const getSessions = async () => {
  const { data } = await apiClient.get<{ data: Session[] }>('/sessions');
  return data.data;
};

export const getActiveSession = async () => {
  const { data } = await apiClient.get<{ data: Session }>('/sessions/active');
  return data.data;
};

export const createSession = async (payload: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data } = await apiClient.post<{ data: Session }>('/sessions', payload);
  return data.data;
};

export const activateSession = async (sessionId: string) => {
  const { data } = await apiClient.post<{ data: Session }>(`/sessions/${sessionId}/activate`);
  return data.data;
};

export const closeSession = async (sessionId: string) => {
  const { data } = await apiClient.post<{ data: Session }>(`/sessions/${sessionId}/close`);
  return data.data;
};
