import { QueryClient } from '@tanstack/react-query';

// Shared so session changes can cancel requests and discard private query data.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
