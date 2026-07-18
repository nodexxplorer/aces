import apiClient, { unwrap } from './client';

export interface SubcategoryItem {
  id: string;
  module: string;
  name: string;
  description?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const SUBCATEGORY_MODULES = [
  { value: 'courses', label: 'Courses' },
  { value: 'dues', label: 'Dues' },
  { value: 'skills', label: 'Skills & Trade' },
  { value: 'events', label: 'Events' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'jobs', label: 'Job Board' },
  { value: 'groups', label: 'Groups' },
] as const;

export const listSubcategories = async (module?: string) => {
  const params = module ? { module } : {};
  const res = await apiClient.get('/subcategories', { params });
  return unwrap<SubcategoryItem[]>(res) ?? [];
};

export const createSubcategory = async (data: { module: string; name: string; description?: string; color?: string; sort_order?: number }) => {
  const res = await apiClient.post('/subcategories', data);
  return unwrap<{ id: string }>(res);
};

export const updateSubcategory = async (id: string, data: { name?: string; description?: string; color?: string; sort_order?: number; is_active?: boolean }) => {
  const res = await apiClient.put(`/subcategories/${id}`, data);
  return unwrap<{ message: string }>(res);
};

export const deleteSubcategory = async (id: string) => {
  const res = await apiClient.delete(`/subcategories/${id}`);
  return unwrap<{ message: string }>(res);
};

export const reorderSubcategories = async (module: string, ids: string[]) => {
  const res = await apiClient.post('/subcategories/reorder', { module, ids });
  return unwrap<{ message: string }>(res);
};
