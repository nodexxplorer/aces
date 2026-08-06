import apiClient, { unwrap } from './client';
import type { Assignment } from '../types';

export const getAssignments = async (courseId: string, sessionId: string) => {
  const res = await apiClient.get(`/assignments/course/${courseId}/session/${sessionId}`);
  return unwrap<Assignment[]>(res);
};

export const getAssignment = async (assignmentId: string) => {
  const res = await apiClient.get(`/assignments/${assignmentId}`);
  return unwrap<Assignment>(res);
};

export const createAssignment = async (payload: {
  courseId: string;
  sessionId: string;
  title: string;
  description?: string;
  dueDate?: string;
}) => {
  const backendPayload = {
    course_id: payload.courseId,
    session_id: payload.sessionId,
    title: payload.title,
    description: payload.description,
    due_date: payload.dueDate,
  };
  const res = await apiClient.post('/assignments', backendPayload);
  return unwrap<Assignment>(res);
};

export const updateAssignment = async (assignmentId: string, payload: Partial<Assignment>) => {
  const res = await apiClient.put(`/assignments/${assignmentId}`, payload);
  return unwrap<Assignment>(res);
};

export const deleteAssignment = async (assignmentId: string) => {
  await apiClient.delete(`/assignments/${assignmentId}`);
};
