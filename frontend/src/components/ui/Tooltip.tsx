import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const positions = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
};

const Tooltip = ({ content, children, position = 'top', className }: TooltipProps) => (
  <div className={cn('relative inline-flex group', className)}>
    {children}
    <div
      role="tooltip"
      className={cn(
        'absolute z-50 px-2.5 py-1.5 text-xs font-medium text-white bg-surface-900 dark:bg-surface-700 rounded-lg shadow-lg',
        'opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap',
        positions[position]
      )}
    >
      {content}
      <div className={cn(
        'absolute w-2 h-2 bg-surface-900 dark:bg-surface-700 rotate-45',
        position === 'top'    && 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2',
        position === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2',
        position === 'left'   && 'left-full top-1/2 -translate-y-1/2 -translate-x-1/2',
        position === 'right'  && 'right-full top-1/2 -translate-y-1/2 translate-x-1/2',
      )} />
    </div>
  </div>
);

export default Tooltip;
