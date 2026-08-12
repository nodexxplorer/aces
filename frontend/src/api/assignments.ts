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
  semesterId: string;
  createdBy: string;
  title: string;
  description?: string;
  deadline: string;
  maxScore: number;
}) => {
  // Field names/requiredness here must match createAssignmentRequest in
  // backend/internal/api/assignment.go exactly — deadline, max_score,
  // created_by, and semester_id are all `binding:"required"` there. This
  // used to send due_date (backend expects deadline) and omit max_score/
  // created_by/semester_id entirely, so every create silently failed
  // binding validation with a generic "internal server error".
  const backendPayload = {
    course_id: payload.courseId,
    session_id: payload.sessionId,
    semester_id: payload.semesterId,
    created_by: payload.createdBy,
    title: payload.title,
    description: payload.description,
    deadline: payload.deadline,
    max_score: payload.maxScore,
    // "Publish Assignment" should mean published — IsActive defaults to the
    // Go zero value (false) when omitted, which would create it inactive.
    is_active: true,
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
