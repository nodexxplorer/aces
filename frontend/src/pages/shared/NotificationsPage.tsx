import { useEffect, useRef } from 'react';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import NotificationItem from '../../components/notifications/NotificationItem';
import { useNotificationStore } from '../../stores/notificationStore';

const categoryTabs = [
  { id: '', label: 'All' },
  { id: 'result', label: 'Results' },
  { id: 'due', label: 'Dues' },
  { id: 'message', label: 'Messages' },
  { id: 'auth', label: 'Auth' },
  { id: 'connect', label: 'Connect' },
  { id: 'skill', label: 'Skills' },
  { id: 'alumni', label: 'Alumni' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'approval', label: 'Approvals' },
  { id: 'system', label: 'System' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'course', label: 'Course' },
];

const statusTabs = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
];

const NotificationsPage = () => {
  const notifications = useNotificationStore((s) => s.notifications);
  const total = useNotificationStore((s) => s.total);
  const loading = useNotificationStore((s) => s.loading);
  const loadingMore = useNotificationStore((s) => s.loadingMore);
  const selectedCategory = useNotificationStore((s) => s.selectedCategory);
  const selectedStatus = useNotificationStore((s) => s.selectedStatus);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const fetchMoreNotifications = useNotificationStore((s) => s.fetchMoreNotifications);
  const setSelectedCategory = useNotificationStore((s) => s.setSelectedCategory);
  const setSelectedStatus = useNotificationStore((s) => s.setSelectedStatus);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications(true);
  }, [selectedCategory, selectedStatus, fetchNotifications]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && notifications.length < total) {
          fetchMoreNotifications();
        }
      },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadingMore, notifications.length, total, fetchMoreNotifications]);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    fetchUnreadCount();
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              leftIcon={<CheckCheck className="w-4 h-4" />}
            >
              Mark all read
            </Button>
          )}
          <Link to="/notifications/settings">
            <Button variant="ghost" size="sm" leftIcon={<Settings className="w-4 h-4" />}>
              Settings
            </Button>
          </Link>
        </div>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="px-4 py-2">
          <Tabs
            tabs={categoryTabs.map((t) => ({
              ...t,
              badge: t.id === '' ? (unreadCount > 0 ? unreadCount : undefined) : undefined,
            }))}
            activeTab={selectedCategory}
            onChange={setSelectedCategory}
          />
        </div>
        <div className="px-4 pt-2 border-b border-surface-200 dark:border-surface-700">
          <div className="flex gap-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedStatus === tab.id
                    ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                    : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
          {loading && notifications.length === 0 ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-8 h-8 text-surface-400" />}
              title="No notifications"
              description={
                selectedCategory || selectedStatus !== 'all'
                  ? 'Try adjusting your filters to see more notifications.'
                  : 'When you get notifications, they\'ll appear here.'
              }
            />
          ) : (
            <>
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  showDelete
                  onClick={() => {}}
                />
              ))}
              {notifications.length < total && (
                <div ref={sentinelRef} className="p-4 flex justify-center">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-sm text-surface-400">
                      <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
                      Loading more...
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default NotificationsPage;
