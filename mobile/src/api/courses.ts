import apiClient, { unwrap } from './client';

export interface Course {
  id: string;
  code: string;
  title: string;
  unit: number;
  level: number;
  semester: string;
}

export interface CourseMaterial {
  id: string;
  title: string;
  description?: string;
  material_type: 'slide' | 'past_question' | 'reading' | 'other';
  uploader_name: string;
  created_at: string;
}

export const getMyRegisteredCourseIDs = async () => {
  const res = await apiClient.get('/course-registrations/my-course-ids');
  const raw = unwrap<{ data: string[] } | string[]>(res);
  return Array.isArray(raw) ? raw : (raw?.data ?? []);
};

export const getCourses = async (params?: { level?: number }) => {
  const res = await apiClient.get('/courses', { params: { perPage: 100, ...params } });
  const raw = unwrap<{ data: Course[] } | Course[]>(res);
  return Array.isArray(raw) ? raw : (raw?.data ?? []);
};

export const listCourseMaterialsByCourse = async (courseId: string) => {
  const res = await apiClient.get(`/course-materials/course/${courseId}`);
  return unwrap<CourseMaterial[]>(res);
};

export const getCourseMaterialDownloadUrl = (materialId: string) => {
  const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
  return `${base}/course-materials/${materialId}/download`;
};
