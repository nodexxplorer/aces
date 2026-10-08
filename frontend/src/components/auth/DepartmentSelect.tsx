import type { Department } from '../../api/departments';
import { cn } from '../../utils/cn';

interface DepartmentSelectProps {
  departments: Department[];
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  className?: string;
}

// Department picker for the sign-in and sign-up pages. It renders nothing when
// there is only one department to choose from, so single-department installs
// keep the original form.
export default function DepartmentSelect({ departments, value, onChange, disabled, className }: DepartmentSelectProps) {
  if (departments.length < 2) return null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor="department" className="text-sm font-medium text-surface-700 dark:text-surface-300">
        Department
      </label>
      <select
        id="department"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-lg border bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 text-sm transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
          'border-surface-300 dark:border-surface-600 pl-3 pr-3 py-2',
          'disabled:opacity-60',
        )}
      >
        {departments.map((d) => (
          <option key={d.slug} value={d.slug}>
            {d.institution ? `${d.name}, ${d.institution}` : d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
