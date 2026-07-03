import { WifiOff } from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';

const OfflineBanner = () => {
  const { isOnline } = useOfflineSync();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-warning-500 text-white text-sm font-medium py-2 px-4 shadow-lg"
    >
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>You are offline. Some features may be unavailable until your connection is restored.</span>
    </div>
  );
};

export default OfflineBanner;
