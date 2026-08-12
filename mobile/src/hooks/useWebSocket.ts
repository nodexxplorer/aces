import { useEffect, useRef, useState, useCallback } from 'react';

// Mirrors frontend/src/hooks/useWebSocket.ts — React Native has the same
// global WebSocket API as the browser, so this ports over unchanged.
export function useWebSocket(url?: string) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    try {
      ws.current = new WebSocket(url);
      ws.current.onopen = () => setIsConnected(true);
      ws.current.onclose = () => setIsConnected(false);
      ws.current.onmessage = (event) => setLastMessage(event.data);
      ws.current.onerror = () => setIsConnected(false);
    } catch {
      setIsConnected(false);
    }
    return () => {
      ws.current?.close();
    };
  }, [url]);

  const sendMessage = useCallback((data: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(data);
    }
  }, []);

  return { isConnected, lastMessage, sendMessage };
}

export function getChatSocketUrl(): string | undefined {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '');
  if (!base) return undefined;
  return `${base.replace(/^http/, 'ws')}/api/v1/ws`;
}
