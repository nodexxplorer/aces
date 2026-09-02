import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, BookOpen, User, Megaphone, Loader2, AlertCircle } from 'lucide-react';
import { universalSearch, type SearchResult } from '../../api/additional-features';
import EmptyState from '../../components/ui/EmptyState';

const TYPE_CONFIG: Record<string, { icon: typeof BookOpen; label: string; color: string; bg: string }> = {
  course: {
    icon: BookOpen,
    label: 'Course',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  student: {
    icon: User,
    label: 'Student',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  announcement: {
    icon: Megaphone,
    label: 'Announcement',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
};

export default function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [inputValue, setInputValue] = useState(query);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setInputValue(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    universalSearch(query)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setError('Search failed. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setParams({ q: inputValue.trim() });
    }
  };

  const handleNavigate = (result: SearchResult) => {
    if (result.result_type === 'course') navigate(`/admin/courses/${result.id}`);
    else if (result.result_type === 'student') navigate(`/admin/students/${result.id}`);
    else if (result.result_type === 'announcement') navigate('/announcements');
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.result_type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Search</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Search across courses, students, and announcements
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search for courses, students, announcements..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-50 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </form>

        {!query && !loading && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 text-center">
            <Search className="w-12 h-12 text-surface-300 mx-auto mb-4" />
            <p className="text-surface-500 dark:text-surface-400 text-lg">Enter a search term to get started</p>
            <p className="text-surface-400 dark:text-surface-500 text-sm mt-1">
              Search for courses by code, students by name or matric number, or browse announcements
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 text-surface-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Searching...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {!loading && query && !error && results.length === 0 && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm">
            <EmptyState
              title="No results found"
              description={`No items matching "${query}" were found. Try a different search term.`}
            />
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="space-y-6">
            {Object.entries(grouped).map(([type, items]) => {
              const config = TYPE_CONFIG[type] || {
                icon: Search,
                label: type,
                color: 'text-surface-600',
                bg: 'bg-surface-100',
              };
              const Icon = config.icon;
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-lg ${config.bg}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wide">
                      {config.label}s
                    </h2>
                    <span className="text-xs text-surface-400 ml-auto">
                      {items.length} result{items.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <button
                        key={`${item.result_type}-${item.id}`}
                        onClick={() => handleNavigate(item)}
                        className="w-full text-left bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all"
                      >
                        <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{item.subtitle}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
