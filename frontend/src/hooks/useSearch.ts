import { useState, useCallback, useMemo } from 'react';
import { useDebounce } from './useDebounce';

interface Searchable {
  [key: string]: unknown;
  id?: string;
}

export const useSearch = <T extends Searchable = Searchable>(
  initialQuery = '',
  dataset?: T[],
  searchKeys?: (keyof T)[]
) => {
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);
  const [isSearching, setIsSearching] = useState(false);

  const results = useMemo(() => {
    if (!debouncedQuery.trim() || !dataset || !searchKeys) return dataset ?? [];
    const lower = debouncedQuery.toLowerCase();
    return dataset.filter((item) =>
      searchKeys.some((key) => {
        const val = item[key];
        return val != null && String(val).toLowerCase().includes(lower);
      })
    );
  }, [debouncedQuery, dataset, searchKeys]);

  const clearSearch = useCallback(() => setQuery(''), []);

  return {
    query,
    setQuery,
    debouncedQuery,
    isSearching,
    setIsSearching,
    clearSearch,
    results,
  };
};
