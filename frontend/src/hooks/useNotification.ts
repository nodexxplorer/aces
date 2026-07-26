import { useCallback } from 'react';
import { useNotificationStore } from '../stores/notificationStore';

export const useNotification = () => {
  const { addToast, removeToast, toasts, unreadCount } = useNotificationStore();

  const toast = useCallback((title: string, message = '', type = 'info') => {
    addToast({ type, title, message });
  }, [addToast]);

  const success = useCallback((title: string, message = '') => toast(title, message, 'success'), [toast]);
  const error = useCallback((title: string, message = '') => toast(title, message, 'error'), [toast]);
  const warning = useCallback((title: string, message = '') => toast(title, message, 'warning'), [toast]);
  const info = useCallback((title: string, message = '') => toast(title, message, 'info'), [toast]);

  return { toasts, unreadCount, removeToast, toast, success, error, warning, info };
};
