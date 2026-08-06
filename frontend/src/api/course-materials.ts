import apiClient, { unwrap } from './client';

export type CourseMaterialType = 'slide' | 'past_question' | 'reading' | 'other';

export interface CourseMaterial {
  id: string;
  course_id: string;
  uploaded_by: string;
  session_id: string | null;
  title: string;
  description: string | null;
  material_type: CourseMaterialType;
  file_url: string;
  file_name: string;
  file_size: number;
  download_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  course_code: string;
  course_title: string;
  uploader_name: string;
}

export const uploadCourseMaterial = async (payload: {
  course_id: string;
  title: string;
  description?: string;
  material_type: CourseMaterialType;
  file: File;
}) => {
  const formData = new FormData();
  formData.append('course_id', payload.course_id);
  formData.append('title', payload.title);
  formData.append('material_type', payload.material_type);
  if (payload.description) formData.append('description', payload.description);
  formData.append('file', payload.file);

  const res = await apiClient.post('/course-materials', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<CourseMaterial>(res);
};

export const listCourseMaterialsByCourse = async (courseId: string) => {
  const res = await apiClient.get(`/course-materials/course/${courseId}`);
  return unwrap<CourseMaterial[]>(res);
};

export const listMyCourseMaterials = async () => {
  const res = await apiClient.get('/course-materials/mine');
  return unwrap<CourseMaterial[]>(res);
};

export const getCourseMaterialDownloadUrl = (id: string) => {
  const base = apiClient.defaults.baseURL || '';
  return `${base}/course-materials/${id}/download`;
};

export const deleteCourseMaterial = async (id: string) => {
  await apiClient.delete(`/course-materials/${id}`);
};
