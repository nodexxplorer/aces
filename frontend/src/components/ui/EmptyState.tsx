import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const EmptyState = ({ icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
    <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-4">
      {icon || <Inbox className="w-8 h-8 text-surface-400" />}
    </div>
    <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">{title}</h3>
    {description && <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm mb-6">{description}</p>}
    {action}
  </div>
);

export default EmptyState;
