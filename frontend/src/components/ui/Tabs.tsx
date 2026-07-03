import { useState, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface Tab { id: string; label: string; icon?: ReactNode; badge?: string | number; }
interface TabsProps { tabs: Tab[]; activeTab?: string; onChange: (id: string) => void; className?: string; }

const Tabs = ({ tabs, activeTab, onChange, className }: TabsProps) => {
  const [active, setActive] = useState(activeTab || tabs[0]?.id);
  const current = activeTab ?? active;
  const handleClick = (id: string) => { setActive(id); onChange(id); };

  return (
    <div className={cn('flex gap-1 border-b border-surface-200 dark:border-surface-700 overflow-x-auto', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleClick(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all -mb-px',
            current === tab.id
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-surface-200 dark:bg-surface-700">{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
