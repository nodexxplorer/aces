import apiClient, { unwrap } from './client';

export interface VerificationRecord {
  id: string;
  matric_number: string;
  full_name: string;
  level: number;
  entry_session: string;
  department: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StudentOnboarding {
  id: string;
  user_id: string;
  matric_number: string;
  verification_record_id: string | null;
  match_confidence: number | null;
  submitted_email: string | null;
  submitted_phone: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  verified_name: string | null;
  verified_level: number | null;
  verified_department: string | null;
}

export interface AnnouncementV2 {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  priority: string;
  category: string;
  is_pinned: boolean;
  target_level: number | null;
  target_audience: string[];
  target_levels: number[];
  target_departments: string[];
  attachments: { name: string; url: string; type: string }[];
  requires_acknowledgment: boolean;
  status: string;
  scheduled_for: string | null;
  expires_at: string | null;
  read_count: number;
  acknowledged_count: number;
  pin_order: number | null;
  created_by: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementComment {
  id: string;
  announcement_id: string;
  author_id: string;
  author_name: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
}

export interface AnnouncementTemplate {
  id: string;
  name: string;
  default_title: string;
  default_body: string;
  default_priority: string;
  default_category: string;
  default_requires_acknowledgment: boolean;
  created_at: string;
}

export interface ReadReceipt {
  id: string;
  announcement_id: string;
  student_id: string;
  student_name: string;
  read_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface ReceiptStats {
  read_count: number;
  ack_count: number;
  total_count: number;
}

export interface UnacknowledgedStudent {
  id: string;
  full_name: string;
  email: string;
}

export interface AnnouncementStatusCount {
  status: string;
  count: number;
}

export interface OnboardingCount {
  status: string;
  count: number;
}

// --- Verification ---
export const lookupMatric = async (matricNumber: string): Promise<VerificationRecord> => {
  const res = await apiClient.post('/verification/lookup', { matric_number: matricNumber });
  return unwrap<VerificationRecord>(res);
};

export const verifyMatricForSignup = async (matricNumber: string, fullName: string) => {
  const res = await apiClient.post('/verification/verify', { matric_number: matricNumber, full_name: fullName });
  return res.data.data;
};

export const bulkUploadVerificationRecords = async (records: {
  matric_number: string;
  full_name: string;
  level: number;
  entry_session: string;
  department: string;
  status?: string;
}[]): Promise<{ records_created: number }> => {
  const res = await apiClient.post('/verification/bulk-upload', { records });
  return res.data;
};

export const listVerificationRecords = async (params?: {
  search?: string;
  level?: number;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<VerificationRecord[]> => {
  const res = await apiClient.get('/verification/records', { params });
  return unwrap<VerificationRecord[]>(res);
};

export const updateVerificationRecord = async (id: string, data: {
  full_name?: string;
  level?: number;
  entry_session?: string;
  status?: string;
}): Promise<void> => {
  await apiClient.put(`/verification/records/${id}`, data);
};

export const listUnverifiedStudents = async (): Promise<VerificationRecord[]> => {
  const res = await apiClient.get('/verification/unverified');
  return unwrap<VerificationRecord[]>(res);
};

// --- Onboarding ---
export const createStudentOnboarding = async (data: {
  matric_number: string;
  email?: string;
  phone?: string;
}): Promise<StudentOnboarding> => {
  const res = await apiClient.post('/onboarding', data);
  return unwrap<StudentOnboarding>(res);
};

export const getStudentOnboardingStatus = async (): Promise<StudentOnboarding> => {
  const res = await apiClient.get('/onboarding/status');
  return unwrap<StudentOnboarding>(res);
};

export const listStudentOnboardings = async (params?: {
  status?: string;
  level?: number;
  limit?: number;
  offset?: number;
}): Promise<StudentOnboarding[]> => {
  const res = await apiClient.get('/onboarding/admin/list', { params });
  return unwrap<StudentOnboarding[]>(res);
};

export const getOnboardingCounts = async (): Promise<OnboardingCount[]> => {
  const res = await apiClient.get('/onboarding/admin/counts');
  return unwrap<OnboardingCount[]>(res);
};

export const updateOnboardingStatus = async (id: string, data: {
  status: string;
  rejection_reason?: string;
}): Promise<void> => {
  await apiClient.put(`/onboarding/${id}/status`, data);
};

export const bulkApproveOnboardings = async (ids: string[]): Promise<void> => {
  await apiClient.post('/onboarding/bulk-approve', { ids });
};

const parseJSONField = (field: any): any[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    try {
      const decoded = atob(field);
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

export const normalizeAnnouncement = (ann: any): AnnouncementV2 => {
  if (!ann) return ann;
  return {
    ...ann,
    target_audience: parseJSONField(ann.target_audience),
    target_levels: parseJSONField(ann.target_levels),
    target_departments: parseJSONField(ann.target_departments),
    attachments: parseJSONField(ann.attachments),
  };
};

// --- Announcements V2 ---
export const createAnnouncementV2 = async (data: {
  title: string;
  content: string;
  summary?: string;
  priority?: string;
  category?: string;
  is_pinned?: boolean;
  target_level?: number;
  target_audience?: string[];
  target_levels?: number[];
  target_departments?: string[];
  attachments?: { name: string; url: string; type: string }[];
  requires_acknowledgment?: boolean;
  status?: string;
  scheduled_for?: string;
  expires_at?: string;
}): Promise<AnnouncementV2> => {
  const res = await apiClient.post('/announcements', data);
  return normalizeAnnouncement(unwrap<AnnouncementV2>(res));
};

export const listAdminAnnouncements = async (params?: {
  status?: string;
  priority?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<AnnouncementV2[]> => {
  const res = await apiClient.get('/announcements/admin', { params });
  const raw = unwrap<AnnouncementV2[]>(res);
  return (Array.isArray(raw) ? raw : []).map(normalizeAnnouncement);
};

export const getAnnouncementV2 = async (id: string): Promise<AnnouncementV2> => {
  const res = await apiClient.get(`/announcements/${id}`);
  return normalizeAnnouncement(unwrap<AnnouncementV2>(res));
};

export const updateAnnouncementV2 = async (id: string, data: Partial<{
  title: string;
  content: string;
  summary: string;
  priority: string;
  category: string;
  is_pinned: boolean;
  target_level: number;
  target_audience: string[];
  requires_acknowledgment: boolean;
  status: string;
  expires_at: string;
}>): Promise<void> => {
  await apiClient.put(`/announcements/${id}`, data);
};

export const deleteAnnouncementV2 = async (id: string): Promise<void> => {
  await apiClient.delete(`/announcements/${id}`);
};

export const publishAnnouncement = async (id: string): Promise<void> => {
  await apiClient.post(`/announcements/${id}/publish`);
};

export const archiveAnnouncement = async (id: string): Promise<void> => {
  await apiClient.post(`/announcements/${id}/archive`);
};

export const getAnnouncementStats = async (): Promise<AnnouncementStatusCount[]> => {
  const res = await apiClient.get('/announcements/stats');
  return unwrap<AnnouncementStatusCount[]>(res);
};

export const listStudentAnnouncements = async (params?: {
  limit?: number;
  offset?: number;
}): Promise<AnnouncementV2[]> => {
  const res = await apiClient.get('/announcements/feed', { params });
  const raw = unwrap<AnnouncementV2[]>(res);
  return (Array.isArray(raw) ? raw : []).map(normalizeAnnouncement);
};

export const searchStudentAnnouncements = async (query: string): Promise<AnnouncementV2[]> => {
  const res = await apiClient.get('/announcements/search', { params: { q: query } });
  const raw = unwrap<AnnouncementV2[]>(res);
  return (Array.isArray(raw) ? raw : []).map(normalizeAnnouncement);
};

// --- Read Receipts ---
export const markAnnouncementRead = async (id: string): Promise<void> => {
  await apiClient.post(`/announcements/${id}/read`);
};

export const acknowledgeAnnouncement = async (id: string): Promise<void> => {
  await apiClient.post(`/announcements/${id}/acknowledge`);
};

export const getAnnouncementReadStatus = async (id: string): Promise<{ read: boolean; acknowledged: boolean }> => {
  const res = await apiClient.get(`/announcements/${id}/read-status`);
  return res.data;
};

export const listAnnouncementReceipts = async (id: string): Promise<ReadReceipt[]> => {
  const res = await apiClient.get(`/announcements/${id}/receipts`);
  return unwrap<ReadReceipt[]>(res);
};

export const listUnacknowledgedStudents = async (id: string): Promise<UnacknowledgedStudent[]> => {
  const res = await apiClient.get(`/announcements/${id}/unacknowledged`);
  return unwrap<UnacknowledgedStudent[]>(res);
};

export const getReceiptStats = async (id: string): Promise<ReceiptStats> => {
  const res = await apiClient.get(`/announcements/${id}/receipt-stats`);
  return unwrap<ReceiptStats>(res);
};

// --- Comments ---
export const createAnnouncementComment = async (announcementId: string, content: string, parentCommentId?: string): Promise<AnnouncementComment> => {
  const res = await apiClient.post(`/announcements/${announcementId}/comments`, { content, parent_comment_id: parentCommentId });
  return unwrap<AnnouncementComment>(res);
};

export const listAnnouncementComments = async (announcementId: string): Promise<AnnouncementComment[]> => {
  const res = await apiClient.get(`/announcements/${announcementId}/comments`);
  return unwrap<AnnouncementComment[]>(res);
};

export const deleteAnnouncementComment = async (commentId: string): Promise<void> => {
  await apiClient.delete(`/announcements/comments/${commentId}`);
};

// --- Templates ---
export const listAnnouncementTemplates = async (): Promise<AnnouncementTemplate[]> => {
  const res = await apiClient.get('/announcements/templates');
  return unwrap<AnnouncementTemplate[]>(res);
};

export const createAnnouncementTemplate = async (data: {
  name: string;
  default_title: string;
  default_body: string;
  default_priority?: string;
  default_category?: string;
  default_requires_acknowledgment?: boolean;
}): Promise<AnnouncementTemplate> => {
  const res = await apiClient.post('/announcements/templates', data);
  return unwrap<AnnouncementTemplate>(res);
};
