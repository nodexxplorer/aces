import { cn } from '../../utils/cn';
import type { AlumniStatusType } from '../../types';

const map: Record<AlumniStatusType, { label: string; cls: string }> = {
  pending:   { label: 'Pending',    cls: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400' },
  active:    { label: 'Verified',   cls: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' },
  suspended: { label: 'Suspended',  cls: 'bg-danger-100  text-danger-700  dark:bg-danger-900/30  dark:text-danger-400'  },
  honorary:  { label: 'Honorary',   cls: 'bg-accent-100  text-accent-700  dark:bg-accent-900/30  dark:text-accent-400'  },
};

interface AlumniStatusBadgeProps { status: AlumniStatusType; className?: string }

const AlumniStatusBadge = ({ status, className }: AlumniStatusBadgeProps) => {
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-surface-100 text-surface-600' };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold', cls, className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
};

export default AlumniStatusBadge;
