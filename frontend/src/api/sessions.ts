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

// ─── Session roll-over (batch level promotion) ───

export interface LevelPromotionSummary {
  level: number;
  proposed: number;
  carryover: number;
  confirmed: number;
  held_back: number;
}

export interface LevelPromotion {
  id: string;
  student_id: string;
  user_id: string;
  full_name: string;
  matric_number: string;
  level: number;
  from_level: number;
  to_level: number;
  status: 'proposed' | 'confirmed' | 'held_back' | 'carried_over';
  reason: string;
  confirmed_at: string | null;
}

export interface RollOverOverview {
  summary: LevelPromotionSummary[];
  proposals: LevelPromotion[];
}

export const prepareRollOver = async (sessionId: string) => {
  const res = await apiClient.post('/session-rollover/prepare', { session_id: sessionId });
  return unwrap<{ created: number; total: number }>(res);
};

export const getRollOverOverview = async (sessionId: string) => {
  const res = await apiClient.get(`/session-rollover/${sessionId}`);
  return unwrap<RollOverOverview>(res);
};

export const flipRollOverStudent = async (
  sessionId: string,
  promotionId: string,
  status: 'promote' | 'carryover' | 'held_back',
  reason?: string
) => {
  const res = await apiClient.patch(`/session-rollover/${sessionId}/promotions/${promotionId}`, {
    status,
    reason,
  });
  return unwrap<LevelPromotion>(res);
};

export const confirmRollOver = async (sessionId: string) => {
  const res = await apiClient.post(`/session-rollover/${sessionId}/confirm`, {});
  return unwrap<{ promoted: number; rolled: number; notified: number }>(res);
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
  name: string;
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
