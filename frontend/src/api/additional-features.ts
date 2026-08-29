import apiClient, { unwrap } from './client';

// The backend sends jsonb columns as raw Go []byte, which encoding/json
// serializes as a base64 string rather than embedding the JSON directly —
// this handles both that and a plain JSON-array string, matching the same
// helper already used for announcement targeting fields.
const parseJSONField = <T>(field: unknown): T[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field as T[];
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      // Not valid JSON directly; fall through to try base64-decoding below.
    }
    try {
      const decoded = atob(field);
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      // Not base64-encoded JSON either; give up and return an empty array.
    }
  }
  return [];
};

// Password Reset
export const requestPasswordReset = async (email: string, channel?: string) => {
  const res = await apiClient.post('/auth/request-otp', { email, channel: channel || 'email' });
  return unwrap<{ message: string }>(res);
};

export const verifyPasswordResetOTP = async (email: string, otp: string) => {
  const res = await apiClient.post('/auth/verify-otp', { email, otp });
  return unwrap<{ message: string; token: string }>(res);
};

export const resetPasswordWithOTP = async (email: string, otp: string, password: string) => {
  const res = await apiClient.post('/auth/reset-with-otp', { email, otp, password });
  return unwrap<{ message: string }>(res);
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const res = await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  return unwrap<{ message: string }>(res);
};

// Sessions
export interface ActiveSession {
  id: string;
  user_id: string;
  session_token: string;
  device_info: string;
  ip_address: string;
  user_agent: string;
  last_active_at: string;
  created_at: string;
  expires_at: string;
}

export const getMyActiveSessions = async () => {
  const res = await apiClient.get('/sessions/security');
  return unwrap<ActiveSession[]>(res);
};

export const revokeSession = async (sessionId: string) => {
  const res = await apiClient.delete(`/sessions/security/${sessionId}`);
  return unwrap<{ message: string }>(res);
};

export const revokeAllSessions = async () => {
  const res = await apiClient.delete('/sessions/security');
  return unwrap<{ message: string }>(res);
};

// Study Tasks
export interface StudyTask {
  id: string;
  user_id: string;
  course_id?: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  due_date?: string;
  reminder_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  course_code?: string;
  course_title?: string;
}

export const createStudyTask = async (data: {
  course_id?: string;
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  reminder_at?: string;
}) => {
  const res = await apiClient.post('/study-tasks', data);
  return unwrap<StudyTask>(res);
};

export const listMyStudyTasks = async () => {
  const res = await apiClient.get('/study-tasks');
  return unwrap<StudyTask[]>(res);
};

export const getStudyTask = async (id: string) => {
  const res = await apiClient.get(`/study-tasks/${id}`);
  return unwrap<StudyTask>(res);
};

export const updateStudyTask = async (
  id: string,
  data: Partial<Pick<StudyTask, 'title' | 'description' | 'priority' | 'status' | 'due_date' | 'reminder_at'>>,
) => {
  const res = await apiClient.put(`/study-tasks/${id}`, data);
  return unwrap<{ message: string }>(res);
};

export const deleteStudyTask = async (id: string) => {
  const res = await apiClient.delete(`/study-tasks/${id}`);
  return unwrap<{ message: string }>(res);
};

export const getUpcomingTasks = async () => {
  const res = await apiClient.get('/study-tasks/upcoming');
  return unwrap<StudyTask[]>(res);
};

export const getAIStudyPlan = async () => {
  const res = await apiClient.get('/study-tasks/ai-plan');
  return unwrap<{ plan: string }>(res);
};

// Class Notices
export interface ClassNotice {
  id: string;
  class_rep_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  pinned_order?: number;
  allow_comments: boolean;
  attachment_url?: string;
  expires_at?: string;
  created_at: string;
  author_name?: string;
  comment_count?: number;
  level?: number | null;
  target_user_ids?: string[];
}

export const createClassNotice = async (data: {
  title: string;
  content: string;
  is_pinned?: boolean;
  allow_comments?: boolean;
  attachment_url?: string;
  expires_at?: string;
  // Empty/omitted = every student in the author's level. Non-empty must be
  // user IDs drawn from that same level's roster — the backend silently
  // drops anything outside it.
  target_user_ids?: string[];
}) => {
  const res = await apiClient.post('/class-notices', data);
  return unwrap<ClassNotice>(res);
};

export const listClassNotices = async () => {
  const res = await apiClient.get('/class-notices');
  const notices = unwrap<ClassNotice[]>(res);
  return notices.map((n) => ({ ...n, target_user_ids: parseJSONField<string>(n.target_user_ids) }));
};

export const getClassNotice = async (id: string) => {
  const res = await apiClient.get(`/class-notices/${id}`);
  return unwrap<ClassNotice>(res);
};

export const createNoticeComment = async (noticeId: string, content: string) => {
  const res = await apiClient.post(`/class-notices/${noticeId}/comments`, { content });
  return unwrap<{ id: string; content: string; author_name: string; created_at: string }>(res);
};

export const listNoticeComments = async (noticeId: string) => {
  const res = await apiClient.get(`/class-notices/${noticeId}/comments`);
  return unwrap<{ id: string; content: string; author_name: string; created_at: string }[]>(res);
};

// Expenses
export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  receipt_url?: string;
  status: string;
  submitted_by: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  submitted_by_name?: string;
}

export const createExpense = async (data: {
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  receipt_url?: string;
}) => {
  const res = await apiClient.post('/expenses', data);
  return unwrap<Expense>(res);
};

export const listExpenses = async (status?: string) => {
  const params = status ? { status } : {};
  const res = await apiClient.get('/expenses', { params });
  return unwrap<Expense[]>(res);
};

export const getExpenseSummary = async () => {
  const res = await apiClient.get('/expenses/summary');
  return unwrap<{
    total_expenses: number;
    total_count: number;
    pending_count: number;
    approved_count: number;
    rejected_count: number;
    approved_amount: number;
  }>(res);
};

export const updateExpenseStatus = async (id: string, data: { status: string; rejection_reason?: string }) => {
  const res = await apiClient.put(`/expenses/${id}/status`, data);
  return unwrap<{ message: string }>(res);
};

// Feedback
export interface Feedback {
  id: string;
  user_id: string;
  feedback_type: string;
  title: string;
  description: string;
  rating?: number;
  status: string;
  admin_response?: string;
  created_at: string;
  user_name?: string;
}

export const createFeedback = async (data: {
  feedback_type: string;
  title: string;
  description: string;
  rating?: number;
}) => {
  const res = await apiClient.post('/feedback', data);
  return unwrap<Feedback>(res);
};

export const listFeedback = async (status?: string) => {
  const params = status ? { status } : {};
  const res = await apiClient.get('/feedback', { params });
  return unwrap<Feedback[]>(res);
};

export const listMyFeedback = async () => {
  const res = await apiClient.get('/feedback/my');
  return unwrap<Feedback[]>(res);
};

export const updateFeedbackStatus = async (id: string, data: { status: string; admin_response?: string }) => {
  const res = await apiClient.put(`/feedback/${id}/status`, data);
  return unwrap<{ message: string }>(res);
};

// Help Center
export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  content: string;
  sort_order?: number;
  is_published: boolean;
  view_count: number;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export const listHelpArticles = async (category?: string) => {
  const params = category ? { category } : {};
  const res = await apiClient.get('/help', { params });
  return unwrap<HelpArticle[]>(res);
};

export const getHelpArticle = async (id: string) => {
  const res = await apiClient.get(`/help/${id}`);
  return unwrap<HelpArticle>(res);
};

export const markHelpArticleHelpful = async (id: string) => {
  const res = await apiClient.post(`/help/${id}/helpful`);
  return unwrap<{ message: string }>(res);
};

export const searchHelpArticles = async (q: string) => {
  const res = await apiClient.get('/help/search', { params: { q } });
  return unwrap<HelpArticle[]>(res);
};

// GPA Scenarios
export interface GPAScenarioCourse {
  code: string;
  title: string;
  units: number;
  grade: string;
}

export interface GPAScenario {
  id: string;
  user_id: string;
  name: string;
  courses: GPAScenarioCourse[];
  gpa?: number;
  created_at: string;
  updated_at: string;
}

export const createGPAScenario = async (data: { name: string; courses: GPAScenarioCourse[] }) => {
  const res = await apiClient.post('/gpa-scenarios', data);
  return unwrap<GPAScenario>(res);
};

export const listGPAScenarios = async () => {
  const res = await apiClient.get('/gpa-scenarios');
  return unwrap<GPAScenario[]>(res);
};

export const updateGPAScenario = async (id: string, data: { name?: string; courses?: GPAScenarioCourse[] }) => {
  const res = await apiClient.put(`/gpa-scenarios/${id}`, data);
  return unwrap<{ message: string }>(res);
};

export const deleteGPAScenario = async (id: string) => {
  const res = await apiClient.delete(`/gpa-scenarios/${id}`);
  return unwrap<{ message: string }>(res);
};

// Universal Search
export interface SearchResult {
  result_type: string;
  id: string;
  title: string;
  subtitle: string;
}

export const universalSearch = async (q: string) => {
  const res = await apiClient.get('/search', { params: { q } });
  return unwrap<SearchResult[]>(res);
};

// Feature Flags
export interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  target_roles: string[];
  target_levels: number[];
  percentage: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const listFeatureFlags = async (): Promise<FeatureFlag[]> => {
  const res = await apiClient.get('/feature-flags');
  const flags = unwrap<FeatureFlag[]>(res);
  // target_roles/target_levels are jsonb columns — same base64-string shape
  // as evidence_urls/target_user_ids/calendar target_audience, must go
  // through the same parser or FeatureFlagsPage's .map() throws.
  return flags.map((f) => ({
    ...f,
    target_roles: parseJSONField<string>(f.target_roles),
    target_levels: parseJSONField<number>(f.target_levels),
  }));
};

export const createFeatureFlag = async (data: {
  name: string;
  description?: string;
  is_enabled?: boolean;
  target_roles?: string[];
  target_levels?: number[];
  percentage?: number;
}): Promise<FeatureFlag> => {
  const res = await apiClient.post('/feature-flags', data);
  return unwrap<FeatureFlag>(res);
};

export const toggleFeatureFlag = async (name: string, isEnabled: boolean): Promise<void> => {
  await apiClient.patch(`/feature-flags/${name}/toggle`, { is_enabled: isEnabled });
};

export const updateFeatureFlag = async (
  name: string,
  data: {
    description?: string;
    is_enabled?: boolean;
    target_roles?: string[];
    target_levels?: number[];
    percentage?: number;
  },
): Promise<void> => {
  await apiClient.put(`/feature-flags/${name}`, data);
};

export const deleteFeatureFlag = async (name: string): Promise<void> => {
  await apiClient.delete(`/feature-flags/${name}`);
};
