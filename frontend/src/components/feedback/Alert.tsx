import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  type?: AlertType;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

const styles: Record<AlertType, { container: string; icon: string; text: string }> = {
  info: {
    container: 'bg-primary-50 border-primary-200 dark:bg-primary-950/20 dark:border-primary-800/30',
    icon: 'text-primary-500 dark:text-primary-400',
    text: 'text-primary-800 dark:text-primary-300',
  },
  success: {
    container: 'bg-success-50 border-success-200 dark:bg-success-950/20 dark:border-success-800/30',
    icon: 'text-success-500 dark:text-success-400',
    text: 'text-success-800 dark:text-success-300',
  },
  warning: {
    container: 'bg-warning-50 border-warning-200 dark:bg-warning-950/20 dark:border-warning-800/30',
    icon: 'text-warning-500 dark:text-warning-400',
    text: 'text-warning-800 dark:text-warning-300',
  },
  error: {
    container: 'bg-danger-50 border-danger-200 dark:bg-danger-950/20 dark:border-danger-800/30',
    icon: 'text-danger-500 dark:text-danger-400',
    text: 'text-danger-800 dark:text-danger-300',
  },
};

const icons: Record<AlertType, ReactNode> = {
  info: <Info className="w-5 h-5" />,
  success: <CheckCircle2 className="w-5 h-5" />,
  warning: <AlertCircle className="w-5 h-5" />,
  error: <XCircle className="w-5 h-5" />,
};

const Alert = ({ type = 'info', title, children, onClose, className }: AlertProps) => {
  const currentStyle = styles[type];

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-xl border transition-all duration-200 animate-slide-in',
        currentStyle.container,
        className
      )}
      role="alert"
    >
      <div className={cn('shrink-0 mt-0.5', currentStyle.icon)}>{icons[type]}</div>
      <div className="flex-1 min-w-0">
        {title && <h5 className={cn('text-sm font-semibold mb-1', currentStyle.text)}>{title}</h5>}
        <div className={cn('text-sm leading-relaxed opacity-90', currentStyle.text)}>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={cn(
            'shrink-0 p-1 rounded-lg hover:bg-surface-900/5 dark:hover:bg-white/5 transition-colors self-start',
            currentStyle.icon
          )}
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;
