import { useMultiRole } from '../../hooks/useMultiRole';
import { ROLE_LABELS, ROLE_COLORS } from '../../utils/constants';
import { cn } from '../../utils/cn';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const RoleSwitcher = () => {
  const { availableRoles, activeRole, switchRole, hasMultipleRoles } = useMultiRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!hasMultipleRoles) {
    return <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', ROLE_COLORS[activeRole])}>{ROLE_LABELS[activeRole]}</span>;
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all', ROLE_COLORS[activeRole])}>
        {ROLE_LABELS[activeRole]}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-dropdown py-1 z-50 animate-scale-in">
          <p className="px-3 py-1.5 text-xs text-surface-500 font-medium">Switch Role</p>
          {availableRoles.map((role) => (
            <button
              key={role}
              onClick={() => { switchRole(role); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                role === activeRole ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', role === activeRole ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600')} />
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoleSwitcher;
