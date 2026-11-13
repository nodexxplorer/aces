import { useNotificationStore } from '../stores/notificationStore';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { syncBrowserPush, disableBrowserPush, syncBrowserPushOwner } from '../hooks/browserPush';
export default function BrowserPushSession() {
  const owner = useAuthStore((s) => (s.isAuthenticated ? `${s.user?.tenant?.slug}:${s.user?.id}` : ''));
  const prior = useRef(owner);
  useEffect(() => {
    void syncBrowserPushOwner().catch(() => {});
    const changed = prior.current !== owner;
    prior.current = owner;
    if (changed) {
      useNotificationStore.setState({ preferences: null, notifications: [], unreadCount: 0, categories: [], total: 0 });
      void disableBrowserPush(false).catch(() => {});
    } else if (owner) {
      void syncBrowserPush().catch(() => {});
    }
  }, [owner]);
  return null;
}
