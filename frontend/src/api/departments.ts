import apiClient from './client';

export interface Department {
  slug: string;
  name: string;
  institution?: string;
  faculty?: string;
  /** True for the department used when none is named (mobile, and the first choice on web). */
  default?: boolean;
}

// Public list of active departments. The response is a bare array, not the
// usual { data } envelope.
export const listDepartments = async (): Promise<Department[]> => {
  const { data } = await apiClient.get<Department[]>('/tenants');
  return data;
};
