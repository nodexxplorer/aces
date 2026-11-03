import { WifiOff, Zap } from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';

const OfflineBanner = () => {
  const { isOnline, isSlowConnection, pendingSync } = useOfflineSync();

  if (isOnline && !isSlowConnection && pendingSync === 0) return null;

  if (!isOnline) {
    return (
      <div
        role="alert"
        className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-amber-600 text-white text-xs sm:text-sm font-medium py-1.5 px-4 shadow-md backdrop-blur"
      >
        <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
        <span>
          Offline Mode active — browsing cached data.{' '}
          {pendingSync > 0 && `(${pendingSync} action${pendingSync > 1 ? 's' : ''} queued for sync)`}
        </span>
      </div>
    );
  }

  if (isSlowConnection) {
    return (
      <div
        role="status"
        className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-blue-600/95 text-white text-xs sm:text-sm font-medium py-1 px-4 shadow-sm backdrop-blur"
      >
        <Zap className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Low network detected, ultra-low latency caching active</span>
      </div>
    );
  }

  return null;
};

export default OfflineBanner;
