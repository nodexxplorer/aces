import { useState, useEffect } from 'react';
import { clearPendingActions } from '../db/offlineDb';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    // Older versions queued writes without a replay mechanism. Discard them;
    // replaying them now could duplicate operations already committed remotely.
    void clearPendingActions();

    const checkConnectionSpeed = () => {
      const conn = (
        navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean; rtt?: number } }
      ).connection;
      if (conn) {
        const slow =
          conn.effectiveType === '2g' ||
          conn.effectiveType === 'slow-2g' ||
          (conn.rtt !== undefined && conn.rtt > 1000) ||
          conn.saveData === true;
        setIsSlowConnection(Boolean(slow));
      }
    };

    checkConnectionSpeed();

    const handleOnline = () => {
      setIsOnline(true);
      checkConnectionSpeed();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSlowConnection(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = (navigator as unknown as { connection?: EventTarget }).connection;
    if (conn && 'addEventListener' in conn) {
      conn.addEventListener('change', checkConnectionSpeed);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && 'removeEventListener' in conn) {
        conn.removeEventListener('change', checkConnectionSpeed);
      }
    };
  }, []);

  return { isOnline, isSlowConnection };
};
