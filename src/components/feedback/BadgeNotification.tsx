import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface BadgeNotificationProps {
  count: number;
  max?: number;
  children: ReactNode;
  className?: string;
}

const BadgeNotification = ({ count, max = 99, children, className }: BadgeNotificationProps) => {
  const displayCount = count > max ? `${max}+` : count;

  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      {children}
      {count > 0 && (
        <span
          className={cn(
            'absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-bold text-white bg-danger-500 border-2 border-white dark:border-surface-900 rounded-full shadow-sm animate-pulse-subtle'
          )}
        >
          {displayCount}
        </span>
      )}
    </div>
  );
};

export default BadgeNotification;
