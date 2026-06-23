import { Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchBar = ({ value, onChange, placeholder = 'Search...', className }: SearchBarProps) => (
  <div className={cn('relative', className)}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 pl-10 pr-9 py-2 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
    />
    {value && (
      <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

export default SearchBar;
