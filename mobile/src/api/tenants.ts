import apiClient from './client';

/** A department, as the public list at GET /tenants returns it. */
export interface Department {
  slug: string;
  name: string;
  institution?: string;
  faculty?: string;
  /** Department part of its matric numbers, e.g. EG/EE for 20/EG/EE/1234. Absent until the department has one. */
  matricCode?: string;
  description?: string;
  /** API path of the department's logo. Absent when it has none. */
  logoUrl?: string;
  /** The department's accent as #rrggbb, when its logo gives one. */
  accentColor?: string;
  /** The department's short name in web addresses: /co is its sign-in page. Absent until it is set. */
  urlCode?: string;
  /** True for the department used when none is named. */
  default?: boolean;
}

/** The public list of active departments. The response is a bare array, not the usual { data } envelope. */
export const listDepartments = async (): Promise<Department[]> => {
  const { data } = await apiClient.get<Department[]>('/tenants');
  return data;
};

/** The department whose short name is code (as in /co or aceszone://co), ignoring case. */
export const findDepartmentByCode = (departments: Department[], code?: string | null): Department | undefined => {
  const wanted = code?.trim().toLowerCase();
  return wanted ? departments.find((d) => d.urlCode?.toLowerCase() === wanted) : undefined;
};

/** The department to start from: the one a link names, else the one chosen last time, else the default, else the first. */
export const pickInitialDepartment = (
  departments: Department[],
  stored: string | null,
  code?: string | null,
): Department | undefined =>
  findDepartmentByCode(departments, code) ??
  departments.find((d) => d.slug === stored) ??
  departments.find((d) => d.default) ??
  departments[0];
