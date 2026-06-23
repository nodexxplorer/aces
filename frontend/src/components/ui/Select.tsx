import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={selectId} className="text-sm font-medium text-surface-700 dark:text-surface-300">{label}</label>}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full appearance-none rounded-lg border bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 text-sm px-3 py-2 pr-10 transition-all',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
              error ? 'border-danger-500' : 'border-surface-300 dark:border-surface-600',
              className
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
        </div>
        {error && <p className="text-xs text-danger-500">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
