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

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-surface-50 dark:hover:bg-surface-700/50 group',
        !notification.is_read && 'bg-primary-500/5'
      )}
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', config.bg)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            'text-sm truncate',
            !notification.is_read
              ? 'font-semibold text-surface-900 dark:text-surface-100'
              : 'font-medium text-surface-700 dark:text-surface-300'
          )}>
            {notification.title}
          </p>
        </div>
        <p className="text-xs text-surface-500 dark:text-surface-400 truncate mt-0.5">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-surface-400 dark:text-surface-500">
            {timeAgo(notification.created_at)}
          </span>
          {notification.priority === 'high' || notification.priority === 'critical' ? (
            <span className="text-[10px] font-medium text-danger-500 uppercase">
              {notification.priority}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteNotification(notification.id);
            }}
            className="p-1 rounded text-surface-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/20 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {!notification.is_read && (
          <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />
        )}
      </div>
    </div>
  );
};

export default NotificationItem;
