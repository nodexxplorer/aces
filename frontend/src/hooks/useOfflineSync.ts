import { useState, useEffect, useRef } from 'react';
import { getPendingActions, saveOfflineAction } from '../db/offlineDb';

interface QueuedAction {
  action: string;
  data: unknown;
}

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const queueRef = useRef<QueuedAction[]>([]);

  useEffect(() => {
    // Check pending count
    getPendingActions().then((actions) => {
      setPendingSync(actions.length);
    });

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
      getPendingActions().then((actions) => setPendingSync(actions.length));
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

  const queueAction = async (action: string, data: unknown) => {
    queueRef.current.push({ action, data });
    await saveOfflineAction(action, data);
    setPendingSync((prev) => prev + 1);
  };

  return { isOnline, isSlowConnection, pendingSync, queueAction };
};
