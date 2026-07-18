import apiClient from './client';
import type { Assignment } from '../types';

export const getAssignments = async (courseId: string, sessionId: string) => {
  const { data } = await apiClient.get<{ data: Assignment[] }>(`/assignments/course/${courseId}/session/${sessionId}`);
  return data.data;
};

export const getAssignment = async (assignmentId: string) => {
  const { data } = await apiClient.get<{ data: Assignment }>(`/assignments/${assignmentId}`);
  return data.data;
};

export const createAssignment = async (payload: { courseId: string; sessionId: string; title: string; description?: string; dueDate?: string }) => {
  const { data } = await apiClient.post<{ data: Assignment }>('/assignments', payload);
  return data.data;
};

export const updateAssignment = async (assignmentId: string, payload: Partial<Assignment>) => {
  const { data } = await apiClient.put<{ data: Assignment }>(`/assignments/${assignmentId}`, payload);
  return data.data;
};

export const deleteAssignment = async (assignmentId: string) => {
  await apiClient.delete(`/assignments/${assignmentId}`);
};
