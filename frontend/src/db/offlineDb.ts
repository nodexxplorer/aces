const DB_NAME = 'aces-zone-offline';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pending_actions')) {
        db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };
  });

export const saveOfflineAction = async (action: string, data: unknown) => {
  const db = await openDB();
  const tx = db.transaction('pending_actions', 'readwrite');
  tx.objectStore('pending_actions').add({ action, data, timestamp: Date.now() });
};

export const getPendingActions = async () => {
  const db = await openDB();
  return new Promise<unknown[]>((resolve) => {
    const tx = db.transaction('pending_actions', 'readonly');
    const req = tx.objectStore('pending_actions').getAll();
    req.onsuccess = () => resolve(req.result);
  });
};

export const clearPendingActions = async () => {
  const db = await openDB();
  const tx = db.transaction('pending_actions', 'readwrite');
  tx.objectStore('pending_actions').clear();
};

export const cacheData = async (key: string, data: unknown) => {
  const db = await openDB();
  const tx = db.transaction('cache', 'readwrite');
  tx.objectStore('cache').put({ key, data, timestamp: Date.now() });
};

export const getCachedData = async <T>(key: string): Promise<T | null> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('cache', 'readonly');
    const req = tx.objectStore('cache').get(key);
    req.onsuccess = () => resolve(req.result?.data ?? null);
  });
};
