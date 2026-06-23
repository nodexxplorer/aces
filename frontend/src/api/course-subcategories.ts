import apiClient from './client';
import type { SkillCategory } from '../types';

export const getCourseSubcategories = async () => {
  const { data } = await apiClient.get<{ data: SkillCategory[] }>('/course-subcategories');
  return data.data;
};

export const createCourseSubcategory = async (payload: { name: string; description?: string }) => {
  const { data } = await apiClient.post<{ data: SkillCategory }>('/course-subcategories', payload);
  return data.data;
};

export const updateCourseSubcategory = async (id: string, payload: { name?: string; description?: string }) => {
  const { data } = await apiClient.put<{ data: SkillCategory }>(`/course-subcategories/${id}`, payload);
  return data.data;
};

export const deleteCourseSubcategory = async (id: string) => {
  await apiClient.delete(`/course-subcategories/${id}`);
};
