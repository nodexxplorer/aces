import { cn } from '../../utils/cn';

type ManualStatus = 'available' | 'purchased' | 'printing' | 'ready' | 'collected';

const map: Record<ManualStatus, { label: string; cls: string }> = {
  available: { label: 'Available',  cls: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' },
  purchased: { label: 'Purchased',  cls: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' },
  printing:  { label: 'Printing',   cls: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400' },
  ready:     { label: 'Ready',      cls: 'bg-accent-100  text-accent-700  dark:bg-accent-900/30  dark:text-accent-400'  },
  collected: { label: 'Collected',  cls: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400'   },
};

interface ManualStatusBadgeProps { status: ManualStatus; className?: string }

const ManualStatusBadge = ({ status, className }: ManualStatusBadgeProps) => {
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-surface-100 text-surface-600' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', cls, className)}>
      {label}
    </span>
  );
};

export default ManualStatusBadge;
