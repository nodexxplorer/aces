import apiClient, { unwrap } from './client';
import type { User } from '../types';

export interface AuditLog {
  id: string;
  student_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_by_name?: string;
  changed_by_role: string;
  change_type: string;
  reason: string | null;
  ip_address: string | null;
  request_id: string | null;
  created_at: string;
}

export interface StudentDocument {
  id: string;
  student_id: string;
  doc_type: string;
  file_url: string;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile extends User {
  audit_logs?: AuditLog[];
  documents?: StudentDocument[];
}

export const updateBasicInfo = async (payload: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  homeAddress?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}) => {
  const res = await apiClient.put('/profile-edit/basic-info', payload);
  return unwrap<{ data: User }>(res);
};

export const uploadProfilePhoto = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/profile-edit/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<{ avatar_url: string }>(res);
};

export const uploadStudentDocument = async (file: File, docType: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);
  const res = await apiClient.post('/profile-edit/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<StudentDocument>(res);
};

export const listStudentDocuments = async () => {
  const res = await apiClient.get('/profile-edit/documents');
  return unwrap<{ data: StudentDocument[] }>(res);
};

// HOD endpoints
export const getStudentFullProfile = async (userId: string) => {
  const res = await apiClient.get(`/hod/students/${userId}`);
  const raw = unwrap<{ data: StudentProfile; audit_logs?: AuditLog[]; documents?: StudentDocument[] }>(res);
  if (raw.data) {
    raw.data.audit_logs = (raw as any).audit_logs;
    raw.data.documents = (raw as any).documents;
  }
  return raw.data || raw;
};

export const hodEditStudent = async (userId: string, payload: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  homeAddress?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  matricNumber?: string;
  level?: string;
  academicStanding?: string;
  graduationStatus?: string;
  admissionMode?: string;
  yearAdmitted?: string;
  reason?: string;
}) => {
  const res = await apiClient.put(`/hod/students/${userId}`, payload);
  return unwrap<{ data: User }>(res);
};

export const getStudentAuditLogs = async (studentId: string, page = 1, perPage = 20) => {
  const res = await apiClient.get(`/hod/students/${studentId}/audit-logs`, {
    params: { page, per_page: perPage },
  });
  return unwrap<{ data: AuditLog[]; total: number; page: number; per_page: number }>(res);
};

export const getAllAuditLogs = async (page = 1, perPage = 50) => {
  const res = await apiClient.get('/audit-logs', {
    params: { page, per_page: perPage },
  });
  return unwrap<{ data: AuditLog[] }>(res);
};

export const bulkUpdateStudents = async (payload: {
  student_ids: string[];
  action: string;
  level?: string;
  academic_standing?: string;
  graduation_status?: string;
  reason: string;
}) => {
  const res = await apiClient.post('/hod/students/bulk-update', payload);
  return unwrap<{ updated: number; errors: string[] }>(res);
};

export const listPendingDocuments = async (page = 1, perPage = 20) => {
  const res = await apiClient.get('/documents/pending', {
    params: { page, per_page: perPage },
  });
  return unwrap<{ data: StudentDocument[]; total: number }>(res);
};

export const verifyDocument = async (docId: string) => {
  const res = await apiClient.post(`/documents/${docId}/verify`);
  return unwrap<StudentDocument>(res);
};

export const rejectDocument = async (docId: string, reason: string) => {
  const res = await apiClient.post(`/documents/${docId}/reject`, { reason });
  return unwrap<StudentDocument>(res);
};
