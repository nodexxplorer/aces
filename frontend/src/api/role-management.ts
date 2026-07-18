import apiClient, { unwrap } from './client';
import type { UserRole, RoleAssignmentLog, StudentForRoleManagement, User } from '../types';

// ==================== ADMIN PERMISSIONS ====================

export const getAdminPermissions = async () => {
  const res = await apiClient.get('/admin-permissions');
  return unwrap<any[]>(res);
};

export const getAdminPermission = async (userId: string) => {
  const res = await apiClient.get(`/admin-permissions/${userId}`);
  return unwrap<any>(res);
};

export const grantAdminPermission = async (userId: string, permissions: {
  canApproveResults?: boolean;
  canManageComplaints?: boolean;
  canViewAnalytics?: boolean;
  canManageUsers?: boolean;
}) => {
  const res = await apiClient.post('/admin-permissions', { userId, ...permissions });
  return unwrap<User>(res);
};

export const updateAdminPermission = async (userId: string, permissions: {
  canApproveResults?: boolean;
  canManageComplaints?: boolean;
  canViewAnalytics?: boolean;
  canManageUsers?: boolean;
}) => {
  const res = await apiClient.put(`/admin-permissions/${userId}`, permissions);
  return unwrap<User>(res);
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
  return unwrap<any[]>(res);
};

export const createRole = async (payload: { name: string; description?: string; permissions?: string[] }) => {
  const res = await apiClient.post('/roles', payload);
  return unwrap<any>(res);
};

// ==================== STUDENT ROLE MANAGEMENT ====================

export const searchStudentsForRoles = async (params: {
  search?: string;
  page?: number;
  per_page?: number;
}) => {
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

export const getRoleAssignmentLogs = async (params?: {
  limit?: number;
  offset?: number;
}) => {
  const res = await apiClient.get('/roles/logs', { params });
  return unwrap<RoleAssignmentLog[]>(res);
};

export const getRoleLogsByUser = async (userId: string, params?: {
  limit?: number;
  offset?: number;
}) => {
  const res = await apiClient.get(`/roles/logs/user/${userId}`, { params });
  return unwrap<RoleAssignmentLog[]>(res);
};

// ==================== ROLE COUNTS ====================

export const getAdditionalRolesCount = async () => {
  const res = await apiClient.get('/roles/additional-count');
  const data = res.data;
  return data.count || 0;
};
