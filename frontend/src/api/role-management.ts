import apiClient, { unwrap } from './client';
import type { UserRole, RoleAssignmentLog, StudentForRoleManagement } from '../types';
import type { AdminGrantKey } from '../config/permissions';

/** The grant flags, named as the API names them (see internal/api/admin_grants.go). */
export type AdminGrantFlags = Record<AdminGrantKey, boolean>;

/** A person's grant as the API returns it. */
export interface AdminPermission extends Partial<AdminGrantFlags> {
  id?: string;
  user_id: string;
  is_active?: boolean;
  granted_at?: string | null;
  expires_at?: string | null;
  granted_by_hod_id?: string;
}

export interface Role {
  id?: string;
  name: string;
  description?: string;
  permissions?: string[];
  userCount?: number;
  isActive?: boolean;
}

// ==================== ADMIN PERMISSIONS ====================
// Grants are HOD-only on the server. A 404 from getAdminPermission means the person has no
// active grant. The server refuses a grant to anyone who does not hold the admin role.

export const getAdminPermissions = async (pageId = 1, pageSize = 50) => {
  const res = await apiClient.get('/admin-permissions', { params: { page_id: pageId, page_size: pageSize } });
  return unwrap<AdminPermission[]>(res);
};

export const getAdminPermission = async (userId: string) => {
  const res = await apiClient.get(`/admin-permissions/${userId}`);
  return unwrap<AdminPermission>(res);
};

export const grantAdminPermission = async (userId: string, flags: AdminGrantFlags) => {
  const res = await apiClient.post('/admin-permissions', { user_id: userId, ...flags });
  return unwrap<AdminPermission>(res);
};

/** Sets every flag. The server reads all of them, so send the full set. */
export const updateAdminPermission = async (userId: string, flags: AdminGrantFlags) => {
  const res = await apiClient.put(`/admin-permissions/${userId}`, flags);
  return unwrap<AdminPermission>(res);
};

export const revokeAdminPermission = async (userId: string) => {
  await apiClient.delete(`/admin-permissions/${userId}`);
};

export const delegateAdmin = async (userId: string) => {
  const res = await apiClient.post('/roles/assign', { user_id: userId, role: 'delegated_admin' });
  return res.data;
};

export const getAllRoles = async () => {
  const res = await apiClient.get('/roles');
  return unwrap<Role[] | { items: Role[] }>(res);
};

export const createRole = async (payload: { name: string; description?: string; permissions?: string[] }) => {
  const res = await apiClient.post('/roles', payload);
  return unwrap<Role>(res);
};

// ==================== STUDENT ROLE MANAGEMENT ====================

export const searchStudentsForRoles = async (params: { search?: string; page?: number; per_page?: number }) => {
  const res = await apiClient.get('/roles/students', { params });
  const data = res.data;
  return {
    data: (data.data || []) as StudentForRoleManagement[],
    total: data.total || 0,
    page: data.page || 1,
    per_page: data.per_page || 20,
  };
};

export const assignUserRole = async (userId: string, role: UserRole, reason?: string) => {
  const res = await apiClient.post('/roles/assign', {
    user_id: userId,
    role: role,
    reason: reason || undefined,
  });
  return res.data;
};

export const revokeUserRole = async (userId: string, role: UserRole, reason?: string) => {
  const res = await apiClient.post('/roles/revoke', {
    user_id: userId,
    role: role,
    reason: reason || undefined,
  });
  return res.data;
};

export const getUserRoleNames = async (userId: string) => {
  const res = await apiClient.get(`/roles/user/${userId}/names`);
  return unwrap<UserRole[]>(res);
};

// ==================== ROLE ASSIGNMENT LOGS ====================

export const getRoleAssignmentLogs = async (params?: { limit?: number; offset?: number }) => {
  const res = await apiClient.get('/roles/logs', { params });
  return unwrap<RoleAssignmentLog[]>(res);
};

export const getRoleLogsByUser = async (
  userId: string,
  params?: {
    limit?: number;
    offset?: number;
  },
) => {
  const res = await apiClient.get(`/roles/logs/user/${userId}`, { params });
  return unwrap<RoleAssignmentLog[]>(res);
};

// ==================== ROLE COUNTS ====================

export const getAdditionalRolesCount = async () => {
  const res = await apiClient.get('/roles/additional-count');
  const data = res.data;
  return data.count || 0;
};
