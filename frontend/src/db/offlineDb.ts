const DB_NAME = 'aces-zone-offline';
const DB_VERSION = 1;

// In-memory cache for ultra-low latency synchronous access
const memoryCache = new Map<string, { data: unknown; timestamp: number }>();

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return reject(new Error('IndexedDB not supported'));
      }
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
    } catch (e) {
      reject(e);
    }
  });

export const saveOfflineAction = async (action: string, data: unknown) => {
  try {
    const db = await openDB();
    const tx = db.transaction('pending_actions', 'readwrite');
    tx.objectStore('pending_actions').add({ action, data, timestamp: Date.now() });
  } catch (err) {
    console.warn('[Offline] Failed to queue offline action:', err);
  }
};

export const getPendingActions = async () => {
  try {
    const db = await openDB();
    return new Promise<unknown[]>((resolve) => {
      const tx = db.transaction('pending_actions', 'readonly');
      const req = tx.objectStore('pending_actions').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

export const clearPendingActions = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('pending_actions', 'readwrite');
    tx.objectStore('pending_actions').clear();
  } catch (err) {
    console.warn('[Offline] Failed to clear pending actions:', err);
  }
};

export const cacheData = async (key: string, data: unknown) => {
  const timestamp = Date.now();
  memoryCache.set(key, { data, timestamp });
  try {
    const db = await openDB();
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').put({ key, data, timestamp });
  } catch {
    // Memory cache already set
  }
};

export const getCachedData = async <T>(key: string): Promise<T | null> => {
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!.data as T;
  }
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('cache', 'readonly');
      const req = tx.objectStore('cache').get(key);
      req.onsuccess = () => {
        const result = req.result;
        if (result?.data !== undefined) {
          memoryCache.set(key, { data: result.data, timestamp: result.timestamp || Date.now() });
          resolve(result.data as T);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const getCachedWithAge = async <T>(
  key: string,
): Promise<{ data: T; ageMs: number; timestamp: number } | null> => {
  const now = Date.now();
  if (memoryCache.has(key)) {
    const item = memoryCache.get(key)!;
    return { data: item.data as T, ageMs: now - item.timestamp, timestamp: item.timestamp };
  }
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('cache', 'readonly');
      const req = tx.objectStore('cache').get(key);
      req.onsuccess = () => {
        const result = req.result;
        if (result?.data !== undefined) {
          const timestamp = result.timestamp || now;
          memoryCache.set(key, { data: result.data, timestamp });
          resolve({ data: result.data as T, ageMs: now - timestamp, timestamp });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const invalidateCache = async (prefix?: string) => {
  if (!prefix) {
    memoryCache.clear();
  } else {
    for (const k of Array.from(memoryCache.keys())) {
      if (k.startsWith(prefix) || k.includes(prefix)) {
        memoryCache.delete(k);
      }
    }
  }
  try {
    const db = await openDB();
    const tx = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    if (!prefix) {
      store.clear();
    } else {
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result || []) as string[];
        for (const k of keys) {
          if (typeof k === 'string' && (k.startsWith(prefix) || k.includes(prefix))) {
            store.delete(k);
          }
        }
      };
    }
  } catch {
    // Ignored
  }
};
