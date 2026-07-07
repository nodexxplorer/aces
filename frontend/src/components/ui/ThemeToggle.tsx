import { Sun, Moon, Monitor } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { cn } from '../../utils/cn';
import { useState, useRef, useEffect } from 'react';

const modes = [
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'system' as const, icon: Monitor, label: 'System' },
];

const ThemeToggle = () => {
  const { mode, setMode, isDark } = useDarkMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300',
          'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700',
          'hover:shadow-xl hover:scale-110 active:scale-95',
          open && 'rotate-45'
        )}
        aria-label="Toggle theme"
      >
        {isDark ? (
          <Moon className="w-5 h-5 text-accent-400" />
        ) : (
          <Sun className="w-5 h-5 text-amber-500" />
        )}
      </button>

      {open && (
        <div className="absolute bottom-16 right-0 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-dropdown p-1.5 min-w-[140px] animate-scale-in origin-bottom-right">
          {modes.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => { setMode(value); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all',
                mode === value
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700/50'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
