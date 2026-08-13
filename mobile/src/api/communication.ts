import apiClient, { unwrap } from './client';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  category: string;
  priority: string;
  action_url?: string;
  action_label?: string;
  created_at: string;
}

export interface AnnouncementFeedItem {
  id: string;
  title: string;
  content: string;
  summary?: string;
  is_pinned: boolean;
  priority: string;
  category: string;
  created_at: string;
  author_name?: string;
}

export const listMyNotifications = async (params?: { category?: string; status?: string }) => {
  const res = await apiClient.get('/notifications/me', { params: { limit: 50, offset: 0, ...params } });
  return unwrap<NotificationItem[]>(res);
};

export const getUnreadCount = async () => {
  const res = await apiClient.get('/notifications/unread-count');
  return unwrap<{ count: number } | number>(res);
};

export const markNotificationRead = async (id: string) => {
  await apiClient.put(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async () => {
  await apiClient.post('/notifications/read-all');
};

export const listAnnouncementsFeed = async () => {
  const res = await apiClient.get('/announcements/feed', { params: { limit: 30, offset: 0 } });
  return unwrap<AnnouncementFeedItem[]>(res);
};

export interface ClassNotice {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  attachment_url?: string;
  expires_at?: string;
  created_at: string;
  author_name?: string;
  comment_count?: number;
}

export interface NoticeComment {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
}

export const listClassNotices = async () => {
  const res = await apiClient.get('/class-notices');
  return unwrap<ClassNotice[]>(res);
};

export const listNoticeComments = async (noticeId: string) => {
  const res = await apiClient.get(`/class-notices/${noticeId}/comments`);
  return unwrap<NoticeComment[]>(res);
};

export const createNoticeComment = async (noticeId: string, content: string) => {
  const res = await apiClient.post(`/class-notices/${noticeId}/comments`, { content });
  return unwrap<NoticeComment>(res);
};
