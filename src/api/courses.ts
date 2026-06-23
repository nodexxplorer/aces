import apiClient from './client';
import type { Course, PaginationParams, PaginatedResponse } from '../types';

export const getCourses = async (params?: PaginationParams & { level?: number; semester?: string }) => {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Course> }>('/courses', { params });
  return data.data;
};

export const getCourse = async (courseId: string) => {
  const { data } = await apiClient.get<{ data: Course }>(`/courses/${courseId}`);
  return data.data;
};

export const createCourse = async (payload: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data } = await apiClient.post<{ data: Course }>('/courses', payload);
  return data.data;
};

export const updateCourse = async (courseId: string, payload: Partial<Course>) => {
  const { data } = await apiClient.put<{ data: Course }>(`/courses/${courseId}`, payload);
  return data.data;
};

export const deleteCourse = async (courseId: string) => {
  await apiClient.delete(`/courses/${courseId}`);
};

export const getMyCourses = async () => {
  const { data } = await apiClient.get<{ data: Course[] }>('/courses/my');
  return data.data;
};

export const registerCourses = async (courseIds: string[]) => {
  const { data } = await apiClient.post<{ data: { registered: number } }>('/courses/register', { courseIds });
  return data.data;
};
