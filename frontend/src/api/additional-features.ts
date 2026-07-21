import apiClient, { unwrap } from './client';

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

// Grade Appeals
export interface GradeAppeal {
  id: string;
  student_id: string;
  course_id: string;
  semester_id: string;
  session_id: string;
  reason: string;
  evidence_urls: string[];
  status: string;
  lecturer_response?: string;
  hod_response?: string;
  original_score?: number;
  revised_score?: number;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  course_code?: string;
  course_title?: string;
  student_name?: string;
}

export const createGradeAppeal = async (data: { course_id: string; semester_id: string; session_id: string; reason: string; evidence?: string[] }) => {
  const res = await apiClient.post('/grade-appeals', data);
  return unwrap<GradeAppeal>(res);
};

export const listMyAppeals = async () => {
  const res = await apiClient.get('/grade-appeals/my');
  return unwrap<GradeAppeal[]>(res);
};

export const listPendingAppeals = async (status?: string) => {
  const params = status ? { status } : {};
  const res = await apiClient.get('/grade-appeals/pending', { params });
  return unwrap<GradeAppeal[]>(res);
};

export const updateAppealStatus = async (id: string, data: { status: string; response?: string; revised_score?: number }) => {
  const res = await apiClient.put(`/grade-appeals/${id}/status`, data);
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

export const createStudyTask = async (data: { course_id?: string; title: string; description?: string; priority?: string; due_date?: string; reminder_at?: string }) => {
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

export const updateStudyTask = async (id: string, data: Partial<Pick<StudyTask, 'title' | 'description' | 'priority' | 'status' | 'due_date' | 'reminder_at'>>) => {
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
}

export const createClassNotice = async (data: { title: string; content: string; is_pinned?: boolean; allow_comments?: boolean; attachment_url?: string; expires_at?: string }) => {
  const res = await apiClient.post('/class-notices', data);
  return unwrap<ClassNotice>(res);
};

export const listClassNotices = async () => {
  const res = await apiClient.get('/class-notices');
  return unwrap<ClassNotice[]>(res);
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

// Emergency Broadcasts
export interface Broadcast {
  id: string;
  sender_id: string;
  title: string;
  message: string;
  priority: string;
  template?: string;
  channels: string[];
  target_roles: string[];
  requires_acknowledgment: boolean;
  created_at: string;
  sender_name?: string;
  acknowledged?: boolean;
  ack_count?: number;
}

export const createBroadcast = async (data: { title: string; message: string; priority?: string; channels?: string[]; target_roles?: string[]; requires_acknowledgment?: boolean }) => {
  const res = await apiClient.post('/broadcasts', data);
  return unwrap<Broadcast>(res);
};

export const listBroadcasts = async () => {
  const res = await apiClient.get('/broadcasts');
  return unwrap<Broadcast[]>(res);
};

export const acknowledgeBroadcast = async (id: string) => {
  const res = await apiClient.post(`/broadcasts/${id}/ack`);
  return unwrap<{ message: string }>(res);
};

export const getBroadcastAckCount = async (id: string) => {
  const res = await apiClient.get(`/broadcasts/${id}/ack-count`);
  return unwrap<{ ack_count: number }>(res);
};

// Calendar Events
export interface CalendarEvent {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time?: string;
  venue?: string;
  target_levels?: number[];
  target_audience?: string[];
  is_all_day: boolean;
  color: string;
  created_at: string;
  creator_name?: string;
}

export const createDepartmentalEvent = async (data: { title: string; description?: string; event_type: string; start_time: string; end_time?: string; venue?: string; target_levels?: number[]; target_audience?: string[]; is_all_day?: boolean; color?: string }) => {
  const res = await apiClient.post('/calendar', data);
  return unwrap<CalendarEvent>(res);
};

export const listDepartmentalEvents = async (start?: string, end?: string) => {
  const params: Record<string, string> = {};
  if (start) params.start = start;
  if (end) params.end = end;
  const res = await apiClient.get('/calendar', { params });
  return unwrap<CalendarEvent[]>(res);
};

export const deleteDepartmentalEvent = async (id: string) => {
  const res = await apiClient.delete(`/calendar/${id}`);
  return unwrap<{ message: string }>(res);
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

export const createExpense = async (data: { description: string; amount: number; category: string; expense_date: string; receipt_url?: string }) => {
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
  return unwrap<{ total_expenses: number; total_count: number; pending_count: number; approved_count: number; rejected_count: number; approved_amount: number }>(res);
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

export const createFeedback = async (data: { feedback_type: string; title: string; description: string; rating?: number }) => {
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
export interface GPAScenario {
  id: string;
  user_id: string;
  name: string;
  courses: any[];
  created_at: string;
  updated_at: string;
}

export const createGPAScenario = async (data: { name: string; courses: any[] }) => {
  const res = await apiClient.post('/gpa-scenarios', data);
  return unwrap<GPAScenario>(res);
};

export const listGPAScenarios = async () => {
  const res = await apiClient.get('/gpa-scenarios');
  return unwrap<GPAScenario[]>(res);
};

export const updateGPAScenario = async (id: string, data: { name?: string; courses?: any[] }) => {
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
