import { create } from 'zustand';
import type { NotificationFull, NotificationPreferences, CategoryCount } from '../api/notifications';
import * as notificationsApi from '../api/notifications';

interface ToastNotification {
  id: string;
  type: string;
  title: string;
  message: string;
}

interface NotificationState {
  notifications: NotificationFull[];
  total: number;
  unreadCount: number;
  categories: CategoryCount[];
  preferences: NotificationPreferences | null;
  loading: boolean;
  loadingMore: boolean;
  selectedCategory: string;
  selectedStatus: string;
  toasts: ToastNotification[];
  _pollInterval: ReturnType<typeof setInterval> | null;

  fetchNotifications: (reset?: boolean) => Promise<void>;
  fetchMoreNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchPreferences: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  addNotification: (notification: NotificationFull) => void;
  setSelectedCategory: (category: string) => void;
  setSelectedStatus: (status: string) => void;
  addToast: (toast: Omit<ToastNotification, 'id'>) => void;
  removeToast: (id: string) => void;
  startPolling: () => void;
  stopPolling: () => void;
}

let toastCounter = 0;

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  total: 0,
  unreadCount: 0,
  categories: [],
  preferences: null,
  loading: false,
  loadingMore: false,
  selectedCategory: '',
  selectedStatus: 'all',
  toasts: [],
  _pollInterval: null,

  fetchNotifications: async (reset = true) => {
    const { selectedCategory, selectedStatus } = get();
    if (reset) set({ loading: true });
    try {
      const { notifications, total } = await notificationsApi.getMyNotifications({
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        limit: 20,
        offset: reset ? 0 : get().notifications.length,
      });
      set((state) => ({
        notifications: reset ? notifications : [...state.notifications, ...notifications],
        total,
      }));
    } catch {
      // silent
    } finally {
      set({ loading: false, loadingMore: false });
    }
  },

  fetchMoreNotifications: async () => {
    const { notifications, total, loadingMore } = get();
    if (loadingMore || notifications.length >= total) return;
    set({ loadingMore: true });
    await get().fetchNotifications(false);
  },

  fetchUnreadCount: async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      set({ unreadCount: count });
    } catch {
      // silent
    }
  },

  fetchCategories: async () => {
    try {
      const categories = await notificationsApi.getUnreadByCategory();
      set({ categories });
    } catch {
      // silent
    }
  },

  fetchPreferences: async () => {
    try {
      const preferences = await notificationsApi.getPreferences();
      set({ preferences });
    } catch {
      // silent
    }
  },

  markAsRead: async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // silent
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationsApi.markAllAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
        categories: [],
      }));
    } catch {
      // silent
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await notificationsApi.deleteNotification(id);
      set((state) => {
        const target = state.notifications.find((n) => n.id === id);
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount: target && !target.is_read
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
          total: Math.max(0, state.total - 1),
        };
      });
    } catch {
      // silent
    }
  },

  updatePreferences: async (prefs: Partial<NotificationPreferences>) => {
    const updated = await notificationsApi.updatePreferences(prefs);
    set({ preferences: updated });
  },

  addNotification: (notification: NotificationFull) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
    }));
  },

  setSelectedCategory: (category: string) => {
    set({ selectedCategory: category, notifications: [], total: 0 });
    get().fetchNotifications(true);
  },

  setSelectedStatus: (status: string) => {
    set({ selectedStatus: status, notifications: [], total: 0 });
    get().fetchNotifications(true);
  },

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => get().removeToast(id), 5000);
  },

  removeToast: (id: string) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  startPolling: () => {
    const { _pollInterval } = get();
    if (_pollInterval) return;
    const interval = setInterval(() => {
      get().fetchUnreadCount();
    }, 30000);
    set({ _pollInterval: interval });
  },

  stopPolling: () => {
    const { _pollInterval } = get();
    if (_pollInterval) {
      clearInterval(_pollInterval);
      set({ _pollInterval: null });
    }
  },
}));
