import { useCallback } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import type { Notification } from '../types';

let toastId = 0;

export const useNotification = () => {
  const { notifications, unreadCount, addNotification, markAsRead, markAllAsRead, removeNotification } = useNotificationStore();

  const toast = useCallback((title: string, message: string, type: string = 'info') => {
    const notification: Notification = {
      id: `toast-${++toastId}`,
      userId: '',
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    addNotification(notification);
    setTimeout(() => removeNotification(notification.id), 5000);
  }, [addNotification, removeNotification]);

  const success = useCallback((title: string, message = '') => toast(title, message, 'success'), [toast]);
  const error = useCallback((title: string, message = '') => toast(title, message, 'error'), [toast]);
  const warning = useCallback((title: string, message = '') => toast(title, message, 'warning'), [toast]);
  const info = useCallback((title: string, message = '') => toast(title, message, 'info'), [toast]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, toast, success, error, warning, info };
};
