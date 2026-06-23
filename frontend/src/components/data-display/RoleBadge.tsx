import { cn } from '../../utils/cn';
import { ROLE_LABELS, ROLE_COLORS } from '../../utils/constants';
import type { UserRole } from '../../types';

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

const RoleBadge = ({ role, className }: RoleBadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full shadow-sm',
      ROLE_COLORS[role] || 'bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-300',
      className
    )}
  >
    {ROLE_LABELS[role] || role}
  </span>
);

export default RoleBadge;
