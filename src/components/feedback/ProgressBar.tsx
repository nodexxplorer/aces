import { cn } from '../../utils/cn';

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
  showPercentage?: boolean;
}

const sizeClasses = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const colorClasses = {
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
};

const ProgressBar = ({
  value,
  max = 100,
  size = 'sm',
  color = 'primary',
  className,
  showPercentage = false,
}: ProgressBarProps) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('w-full', className)}>
      <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
        <div
          className={cn('rounded-full transition-all duration-300 ease-out', sizeClasses[size], colorClasses[color])}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showPercentage && (
        <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 mt-1 block">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
};

export default ProgressBar;
