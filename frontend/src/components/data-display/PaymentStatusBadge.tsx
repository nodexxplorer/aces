import { cn } from '../../utils/cn';
import type { PaymentStatus } from '../../types';

const map: Record<PaymentStatus, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400' },
  completed: { label: 'Completed', cls: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' },
  failed:    { label: 'Failed',    cls: 'bg-danger-100  text-danger-700  dark:bg-danger-900/30  dark:text-danger-400'  },
  refunded:  { label: 'Refunded',  cls: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400'   },
};

interface PaymentStatusBadgeProps { status: PaymentStatus; className?: string }

const PaymentStatusBadge = ({ status, className }: PaymentStatusBadgeProps) => {
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-surface-100 text-surface-600' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', cls, className)}>
      {label}
    </span>
  );
};

export default PaymentStatusBadge;
