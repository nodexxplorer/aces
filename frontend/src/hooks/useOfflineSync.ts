import { useState, useEffect, useRef } from 'react';

interface QueuedAction {
  action: string;
  data: unknown;
}

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const queueRef = useRef<QueuedAction[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueAction = (action: string, data: unknown) => {
    queueRef.current.push({ action, data });
    setPendingSync((prev) => prev + 1);
  };

  return { isOnline, pendingSync, queueAction };
};
