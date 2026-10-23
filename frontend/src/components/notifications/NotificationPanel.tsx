import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Check, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import NotificationItem from './NotificationItem';
import type { NotificationFull } from '../../api/notifications';

interface NotificationPanelProps {
  onClose: () => void;
}

function groupByDate(items: NotificationFull[]): { label: string; items: NotificationFull[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const groups: { TODAY: NotificationFull[]; EARLIER: NotificationFull[] } = {
    TODAY: [],
    EARLIER: [],
  };

  for (const item of items) {
    const d = new Date(item.created_at);
    if (d >= todayStart) {
      groups.TODAY.push(item);
    } else {
      groups.EARLIER.push(item);
    }
  }

  const result: { label: string; items: NotificationFull[] }[] = [];
  if (groups.TODAY.length > 0) result.push({ label: 'TODAY', items: groups.TODAY });
  if (groups.EARLIER.length > 0) result.push({ label: 'EARLIER', items: groups.EARLIER });

  return result;
}

const NotificationPanel = ({ onClose }: NotificationPanelProps) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  useEffect(() => {
    if (notifications.length === 0) {
      fetchNotifications(true);
    }
  }, [notifications.length, fetchNotifications]);

  const displayList = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;
  const recent = displayList.slice(0, 10);
  const grouped = groupByDate(recent);

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
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute right-0 mt-2 w-[360px] sm:w-[390px] max-h-[520px] bg-white dark:bg-[#181a20] border border-slate-200/90 dark:border-[#22252b] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
    >
      {/* ──────────────── HEADER ──────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/70">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Notifications</h3>
          <div className="flex items-center gap-2.5">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-[#1d68ec] dark:text-[#3b82f6] hover:underline transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => {
                onClose();
                navigate('/notifications/settings');
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Notification settings"
              title="Notification preferences"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ──────────────── FILTER PILLS ──────────────── */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
              filter === 'unread'
                ? 'bg-[#1d68ec] text-white border-[#1d68ec] shadow-sm'
                : 'border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            Unread {unreadCount}
          </button>
        </div>
      </div>

      {/* ──────────────── CONTENT LIST OR EMPTY STATE ──────────────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100/60 dark:divide-slate-800/40">
        {recent.length === 0 ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
            {/* Rounded Box with Bell & Green check badge */}
            <div className="relative w-14 h-14 rounded-2xl bg-[#eef4fe] dark:bg-[#1a2333] flex items-center justify-center mb-4">
              <Bell className="w-6 h-6 text-[#1d68ec] dark:text-[#3b82f6]" />
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-[#181a20] shadow-sm">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white">You are all caught up</h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-[240px] leading-relaxed">
              New notifications about results, dues and messages will appear here.
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="pt-2">
              <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.label}
              </div>
              <div className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
                {group.items.map((n) => (
                  <NotificationItem key={n.id} notification={n} onClick={() => handleNotificationClick(n)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ──────────────── FOOTER LINK ──────────────── */}
      <div className="border-t border-slate-100 dark:border-slate-800/80 px-4 py-2.5 bg-white dark:bg-[#181a20]">
        <button
          onClick={() => {
            onClose();
            navigate('/notifications');
          }}
          className="flex items-center justify-center gap-1 w-full text-xs font-semibold text-[#1d68ec] dark:text-[#3b82f6] hover:underline py-1 transition-colors"
        >
          View all notifications
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

export default NotificationPanel;
