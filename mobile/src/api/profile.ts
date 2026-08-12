import apiClient, { unwrap } from './client';
import type { AuthUser } from '../store/authStore';

export interface UpdateBasicInfoPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  homeAddress?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

// Only these personal-info fields are directly editable — academic details
// (matric number, level, department, etc.) go through a separate HOD-approval
// request flow on the web app that mobile v1 doesn't implement yet.
export const updateBasicInfo = async (payload: UpdateBasicInfoPayload) => {
  const res = await apiClient.put('/profile-edit/basic-info', payload);
  return unwrap<AuthUser>(res);
};
