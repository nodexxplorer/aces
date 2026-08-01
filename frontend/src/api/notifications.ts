import apiClient, { unwrap } from './client';

export interface NotificationFull {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  action_url: string | null;
  action_label: string | null;
  email_sent: boolean;
  category: string;
  priority: string;
  sender_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  image_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  email_auth: boolean;
  email_results: boolean;
  email_dues: boolean;
  email_messages: boolean;
  email_connect: boolean;
  email_skills: boolean;
  email_alumni: boolean;
  email_system: boolean;
  push_auth: boolean;
  push_results: boolean;
  push_dues: boolean;
  push_messages: boolean;
  push_connect: boolean;
  push_skills: boolean;
  push_alumni: boolean;
  push_system: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  updated_at: string;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export const getMyNotifications = async (params?: {
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ notifications: NotificationFull[]; total: number }> => {
  const query: Record<string, string | number> = {};
  if (params?.category) query.category = params.category;
  if (params?.status) query.status = params.status;
  if (params?.limit) query.limit = params.limit;
  if (params?.offset) query.offset = params.offset;

  const { data } = await apiClient.get('/notifications/me', { params: query });
  const body = data.data ?? data;
  return {
    notifications: Array.isArray(body) ? body : body.data ?? body.notifications ?? [],
    total: body.total ?? (Array.isArray(body) ? body.length : 0),
  };
};

export const getUnreadCount = async (): Promise<number> => {
  const { data } = await apiClient.get('/notifications/unread-count');
  const res = data.data ?? data;
  return res.count ?? res.unread_count ?? 0;
};

export const getUnreadByCategory = async (): Promise<CategoryCount[]> => {
  const { data } = await apiClient.get('/notifications/unread-by-category');
  return (data.data ?? data) as CategoryCount[];
};

export const markAsRead = async (id: string): Promise<NotificationFull> => {
  const { data } = await apiClient.put(`/notifications/${id}/read`);
  return unwrap<NotificationFull>(data);
};

export const markAllAsRead = async (): Promise<void> => {
  await apiClient.post('/notifications/read-all');
};

export const deleteNotification = async (id: string): Promise<void> => {
  await apiClient.delete(`/notifications/${id}`);
};

export const getPreferences = async (): Promise<NotificationPreferences> => {
  const { data } = await apiClient.get('/notifications/preferences');
  return unwrap<NotificationPreferences>(data);
};

export const updatePreferences = async (
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> => {
  const { data } = await apiClient.put('/notifications/preferences', prefs);
  return unwrap<NotificationPreferences>(data);
};

export const createNotification = async (payload: {
  user_id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  priority?: string;
  action_url?: string;
  action_label?: string;
  entity_type?: string;
  entity_id?: string;
}): Promise<NotificationFull> => {
  const { data } = await apiClient.post('/notifications', payload);
  return unwrap<NotificationFull>(data);
};

export const broadcastNotification = async (payload: {
  title: string;
  message: string;
  type: string;
  category?: string;
  priority?: string;
  action_url?: string;
  action_label?: string;
  roles?: string[];
}): Promise<{ message: string }> => {
  const { data } = await apiClient.post('/notifications/broadcast', payload);
  return data.data ?? data;
};
