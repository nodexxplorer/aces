import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  className?: string;
}

const KpiCard = ({ title, value, change, changeLabel, icon, className }: KpiCardProps) => (
  <div className={cn('rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-800 p-5 shadow-card', className)}>
    <div className="flex items-start justify-between mb-3">
      <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">{title}</p>
      {icon && <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-500">{icon}</div>}
    </div>
    <p className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-1">{value}</p>
    {change !== undefined && (
      <div className={cn('flex items-center gap-1 text-xs font-medium', change >= 0 ? 'text-success-600 dark:text-success-500' : 'text-danger-600 dark:text-danger-500')}>
        {change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        {Math.abs(change)}% {changeLabel || 'vs last month'}
      </div>
    )}
  </div>
);

export default KpiCard;
