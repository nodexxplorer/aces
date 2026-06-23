import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (url?: string) => {
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
    return () => { ws.current?.close(); };
  }, [url]);

  const sendMessage = useCallback((data: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(data);
    }
  }, []);

  return { isConnected, lastMessage, sendMessage };
};
