import apiClient, { unwrap } from './client';
import type { Course } from '../types';

interface BackendCourse {
  id: string;
  code: string;
  title: string;
  description?: string;
  unit: number;
  level: number;
  semester: string;
  course_type: string;
  lecturer_id?: string;
  is_active: boolean;
  max_credit_hours?: number;
  prerequisite_id?: string;
  created_at: string;
  updated_at: string;
}

function mapCourse(c: BackendCourse): Course {
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    description: c.description,
    unit: c.unit,
    creditUnits: c.unit,
    level: c.level,
    semester: c.semester as Course['semester'],
    courseType: c.course_type,
    subcategory: (c.course_type || 'core') as Course['subcategory'],
    lecturerId: c.lecturer_id,
    department: '',
    isActive: c.is_active,
    maxCreditHours: c.max_credit_hours,
    prerequisiteId: c.prerequisite_id,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

export const getCourses = async (params?: { page?: number; perPage?: number; level?: number; semester?: string }) => {
  const queryParams = {
    page_id: params?.page || 1,
    page_size: params?.perPage || 100,
  };
  const res = await apiClient.get('/courses', { params: queryParams });
  const raw = unwrap<BackendCourse[] | { data: BackendCourse[] }>(res);
  const list = Array.isArray(raw) ? raw : (raw as any)?.data ?? [];
  return list.map(mapCourse);
};

export const getCoursesByLevelAndSemester = async (level: number, semester: string) => {
  const res = await apiClient.get('/courses/filter', { params: { level, semester } });
  const raw = unwrap<{ data: BackendCourse[] } | BackendCourse[]>(res);
  const list = Array.isArray(raw) ? raw : (raw as any)?.data ?? [];
  return list.map(mapCourse);
};

export const getCourse = async (courseId: string) => {
  const res = await apiClient.get(`/courses/${courseId}`);
  return mapCourse(unwrap<BackendCourse>(res));
};

export const createCourse = async (payload: { code: string; title: string; unit: number; level: number; semester: string; is_active?: boolean; course_type?: string; lecturer_id?: string; max_credit_hours?: number }) => {
  const res = await apiClient.post('/courses', payload);
  return mapCourse(unwrap<BackendCourse>(res));
};

export const updateCourse = async (courseId: string, payload: Partial<Course>) => {
  const res = await apiClient.put(`/courses/${courseId}`, payload);
  return mapCourse(unwrap<BackendCourse>(res));
};

export const deleteCourse = async (courseId: string) => {
  await apiClient.delete(`/courses/${courseId}`);
};
