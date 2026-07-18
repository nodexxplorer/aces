import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { getNotifications, markAsRead, markAllAsRead } from '../../api/notifications';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Bell, CheckCheck } from 'lucide-react';
import Button from '../../components/ui/Button';
import type { AppNotification } from '../../types';

const NotificationsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    getNotifications(user.id)
      .then(setNotifications)
      .catch(() => notifyError('Error', 'Failed to load notifications'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await markAllAsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      success('Done', 'All notifications marked as read.');
    } catch {
      notifyError('Error', 'Failed to mark notifications as read.');
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch {
      // silent fail
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification(s)` : 'No unread notifications'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} leftIcon={<CheckCheck className="w-4 h-4" />}>
            Mark All Read
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <Card className="p-4 text-center text-sm text-surface-400">Loading notifications...</Card>
        ) : notifications.length === 0 ? (
          <Card className="p-4 text-center text-sm text-surface-400">No notifications yet.</Card>
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={`p-4 flex gap-3 cursor-pointer transition-colors ${!n.isRead ? 'bg-primary-500/5 border-primary-500/20' : ''}`}
              onClick={() => !n.isRead && handleMarkRead(n.id)}
            >
              <Bell className={`w-5 h-5 shrink-0 mt-0.5 ${!n.isRead ? 'text-primary-500' : 'text-surface-400'}`} />
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-surface-900 dark:text-white">{n.title}</h4>
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">{n.message}</p>
                <p className="text-[10px] text-surface-400 mt-2">{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</p>
              </div>
              {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-2" />}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
