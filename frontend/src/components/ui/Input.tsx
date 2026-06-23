import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const isPasswordType = type === 'password';
    const currentType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-surface-700 dark:text-surface-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">{leftIcon}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={currentType}
            className={cn(
              'w-full rounded-lg border bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 text-sm transition-all duration-150',
              'placeholder:text-surface-400 dark:placeholder:text-surface-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
              error
                ? 'border-danger-500 focus:ring-danger-500/20 focus:border-danger-500'
                : 'border-surface-300 dark:border-surface-600',
              leftIcon ? 'pl-10' : 'pl-3',
              isPasswordType || rightIcon ? 'pr-10' : 'pr-3',
              'py-2',
              className
            )}
            {...props}
          />
          {isPasswordType ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors focus:outline-none"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          ) : (
            rightIcon && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">{rightIcon}</div>
            )
          )}
        </div>
        {error && <p className="text-xs text-danger-500">{error}</p>}
        {hint && !error && <p className="text-xs text-surface-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
