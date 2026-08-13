import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import ThemeInitializer from './components/ThemeInitializer';
import ErrorBoundary from './components/feedback/ErrorBoundary';
import { ToastContainer } from './components/feedback/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeInitializer>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          {/* Rendered once at the app root — any route lacking AppShell/
              PublicLayout (onboarding, login/celebration, etc.) previously
              had nowhere for toasts to mount, so every success/error
              notification on those pages was silently dropped. */}
          <ToastContainer />
        </QueryClientProvider>
      </ThemeInitializer>
    </ErrorBoundary>
  );
}

export default App;
