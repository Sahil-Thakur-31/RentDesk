import { useSyncExternalStore } from 'react';
import { appStorage } from './appStorage';
import { handleServerEvent } from './realtimeSync';

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

let socket: WebSocket | null = null;
let status: RealtimeStatus = 'offline';
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manuallyClosed = true;

const listeners = new Set<() => void>();

const setStatus = (next: RealtimeStatus) => {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => status;

export const useRealtimeStatus = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

const getWsUrl = () => {
  const apiBase = String(import.meta.env.VITE_API_URL || 'http://localhost:4000/api');
  const wsBase = apiBase.replace(/^http/i, 'ws').replace(/\/api\/?$/, '');
  return `${wsBase}/ws`;
};

const scheduleReconnect = () => {
  if (manuallyClosed) return;
  reconnectAttempt += 1;
  const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempt, 5));
  setStatus('reconnecting');
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectRealtime();
  }, delay);
};

export const connectRealtime = () => {
  manuallyClosed = false;
  const token = appStorage.getItem('rentdesk_token');
  if (!token) {
    setStatus('offline');
    return;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  setStatus('connecting');

  let ws: WebSocket;
  try {
    ws = new WebSocket(`${getWsUrl()}?token=${encodeURIComponent(token)}`);
  } catch {
    scheduleReconnect();
    return;
  }
  socket = ws;

  ws.onopen = () => {
    reconnectAttempt = 0;
    setStatus('connected');
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(String(event.data));
      if (message?.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      handleServerEvent(message);
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
    if (manuallyClosed) {
      setStatus('offline');
    } else {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    ws.close();
  };
};

export const disconnectRealtime = () => {
  manuallyClosed = true;
  reconnectAttempt = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
  setStatus('offline');
};
