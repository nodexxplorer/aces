import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glass?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddings = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' };

const Card = ({ children, className, hover, glass, padding = 'md', onClick }: CardProps) => (
  <div
    className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700/50 bg-white dark:bg-surface-800 shadow-card',
      hover && 'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
      glass && 'glass',
      paddings[padding],
      className
    )}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex items-center justify-between mb-4', className)}>{children}</div>
);

export const CardTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h3 className={cn('text-lg font-semibold text-surface-900 dark:text-surface-100', className)}>{children}</h3>
);

export const CardDescription = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-sm text-surface-500 dark:text-surface-400', className)}>{children}</p>
);

export default Card;
