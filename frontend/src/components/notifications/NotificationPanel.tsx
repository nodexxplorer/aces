import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCheck, ArrowRight } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import NotificationItem from './NotificationItem';
import EmptyState from '../ui/EmptyState';
import type { NotificationFull } from '../../api/notifications';

interface NotificationPanelProps {
  onClose: () => void;
}

function groupByDate(items: NotificationFull[]): { label: string; items: NotificationFull[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const groups: Record<string, NotificationFull[]> = { Today: [], Yesterday: [], Earlier: [] };

  for (const item of items) {
    const d = new Date(item.created_at);
    if (d >= todayStart) groups.Today.push(item);
    else if (d >= yesterdayStart) groups.Yesterday.push(item);
    else groups.Earlier.push(item);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

const NotificationPanel = ({ onClose }: NotificationPanelProps) => {
  const navigate = useNavigate();
  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const recent = notifications.slice(0, 10);
  const grouped = groupByDate(recent);

  useEffect(() => {
    if (notifications.length === 0) {
      fetchNotifications(true);
    }
  }, [notifications.length, fetchNotifications]);

  const handleNotificationClick = async (n: NotificationFull) => {
    if (!n.is_read) {
      await markAsRead(n.id);
      fetchUnreadCount();
    }
    onClose();
    if (n.action_url) {
      navigate(n.action_url);
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    fetchUnreadCount();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 mt-2 w-[380px] max-h-[480px] bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-xl z-50 flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-primary-500 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {recent.length === 0 ? (
          <EmptyState title="No notifications yet" description="When you get notifications, they'll appear here" />
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 bg-surface-50 dark:bg-surface-900/50">
                {group.label}
              </div>
              {group.items.map((n) => (
                <NotificationItem key={n.id} notification={n} onClick={() => handleNotificationClick(n)} />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-surface-200 dark:border-surface-700 px-4 py-2.5">
        <button
          onClick={() => {
            onClose();
            navigate('/notifications');
          }}
          className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors py-1"
        >
          View all notifications
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

export default NotificationPanel;
