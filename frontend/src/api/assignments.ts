import apiClient from './client';
import type { Assignment } from '../types';

export const getAssignments = async (courseId?: string) => {
  const { data } = await apiClient.get<{ data: Assignment[] }>('/assignments', { params: { courseId } });
  return data.data;
};

export const getAssignment = async (assignmentId: string) => {
  const { data } = await apiClient.get<{ data: Assignment }>(`/assignments/${assignmentId}`);
  return data.data;
};

export const createAssignment = async (payload: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data } = await apiClient.post<{ data: Assignment }>('/assignments', payload);
  return data.data;
};

export const uploadAssignment = async (courseId: string, file: File, title: string, dueDate: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('courseId', courseId);
  formData.append('title', title);
  formData.append('dueDate', dueDate);
  const { data } = await apiClient.post<{ data: Assignment }>('/assignments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};

export const deleteAssignment = async (assignmentId: string) => {
  await apiClient.delete(`/assignments/${assignmentId}`);
};
