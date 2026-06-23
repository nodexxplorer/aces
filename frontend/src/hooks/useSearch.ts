import { useState, useCallback } from 'react';
import { useDebounce } from './useDebounce';

export const useSearch = (initialQuery = '') => {
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);
  const [isSearching, setIsSearching] = useState(false);

  const clearSearch = useCallback(() => setQuery(''), []);

  return { query, setQuery, debouncedQuery, isSearching, setIsSearching, clearSearch };
};
