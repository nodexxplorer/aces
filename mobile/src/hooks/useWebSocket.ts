import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

// Mirrors frontend/src/hooks/useWebSocket.ts, plus auto-reconnect that the
// web version doesn't need — mobile networks drop far more often (elevators,
// cellular handoff, backgrounding), so a socket that only ever reconnects on
// screen remount would leave chat/notifications dead for long stretches.
export function useWebSocket(url?: string) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY_MS);
  const closedByUs = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    closedByUs.current = false;
    reconnectDelay.current = INITIAL_RECONNECT_DELAY_MS;

    const clearReconnectTimer = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    const connect = () => {
      clearReconnectTimer();
      try {
        const socket = new WebSocket(url);
        ws.current = socket;
        socket.onopen = () => {
          setIsConnected(true);
          reconnectDelay.current = INITIAL_RECONNECT_DELAY_MS;
        };
        socket.onmessage = (event) => setLastMessage(event.data);
        socket.onerror = () => setIsConnected(false);
        socket.onclose = () => {
          setIsConnected(false);
          if (closedByUs.current) return;
          reconnectTimer.current = setTimeout(connect, reconnectDelay.current);
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY_MS);
        };
      } catch {
        setIsConnected(false);
      }
    };

    connect();

    // A socket left connected while backgrounded is usually already dead by
    // the time iOS/Android actually kills the connection — jump straight to
    // a reconnect attempt on resume instead of waiting for the next backoff
    // tick or for onclose to ever fire.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && ws.current?.readyState !== WebSocket.OPEN) {
        connect();
      }
    });

    return () => {
      closedByUs.current = true;
      clearReconnectTimer();
      appStateSub.remove();
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
