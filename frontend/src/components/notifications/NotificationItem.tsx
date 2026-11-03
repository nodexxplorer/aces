import { Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { NotificationFull } from '../../api/notifications';
import { useNotificationStore } from '../../stores/notificationStore';
import { getCategoryConfig, timeAgo } from './notificationHelpers';

interface NotificationItemProps {
  notification: NotificationFull;
  onClick: () => void;
  showDelete?: boolean;
}

const NotificationItem = ({ notification, onClick, showDelete = false }: NotificationItemProps) => {
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);
  const config = getCategoryConfig(notification.category);
  const Icon = config.icon;

  const isProfileSetup =
    notification.action_label?.toLowerCase().includes('profile') ||
    notification.title.toLowerCase().includes('welcome') ||
    notification.message.toLowerCase().includes('finish setting up your profile');

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-[#1f222a]',
        !notification.is_read ? 'bg-slate-50/50 dark:bg-[#1a1d24]/50' : '',
      )}
    >
      {/* Category Icon Container */}
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', config.bg)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 pr-1">
        {/* Title + Timestamp row */}
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-xs leading-snug',
              !notification.is_read
                ? 'font-bold text-slate-900 dark:text-white'
                : 'font-semibold text-slate-700 dark:text-slate-300',
            )}
          >
            {notification.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal whitespace-nowrap">
              {timeAgo(notification.created_at)}
            </span>
            {!notification.is_read && <span className="w-2 h-2 rounded-full bg-[#1d68ec] shrink-0" />}
          </div>
        </div>

        {/* Message body */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{notification.message}</p>

        {/* Action Button if specified (e.g. Finish profile) */}
        {(notification.action_label || isProfileSetup) && (
          <div className="mt-2.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#1d68ec] hover:bg-[#1656c4] text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              {notification.action_label || 'Finish profile'}
            </button>
          </div>
        )}
      </div>

      {/* Delete button (optional, visible on hover) */}
      {showDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteNotification(notification.id);
          }}
          className="absolute right-2 bottom-2 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete notification"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default NotificationItem;
