import apiClient from './client';

export interface Department {
  slug: string;
  name: string;
  institution?: string;
  faculty?: string;
  /** Department part of its matric numbers, e.g. EG/EE for 20/EG/EE/1234. Absent until the department has one. */
  matricCode?: string;
  /** Short line about the department, shown on the sign-in page and in the dashboard footer. */
  description?: string;
  /** API path of the department's logo. Absent when it has none. */
  logoUrl?: string;
  /** True for the department used when none is named (mobile, and the first choice on web). */
  default?: boolean;
}

// Public list of active departments. The response is a bare array, not the
// usual { data } envelope.
export const listDepartments = async (): Promise<Department[]> => {
  const { data } = await apiClient.get<Department[]>('/tenants');
  return data;
};
