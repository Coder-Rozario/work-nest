import { API_ROOT_URL } from '../config/env';

// One shared EventSource connection for the whole app, plus a tiny pub/sub layer.
const listeners = new Set();
const statusListeners = new Set();

let source = null;
let status = 'idle';

const setStatus = (next) => {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener(next));
};

export const getRealtimeStatus = () => status;

export const onRealtimeStatus = (listener) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

export const subscribeRealtime = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const connectRealtime = () => {
  if (source || typeof window === 'undefined' || typeof EventSource === 'undefined') return;

  const token = localStorage.getItem('worknest_token');
  if (!token) return;

  setStatus('connecting');

  const streamUrl = `${API_ROOT_URL}/realtime/stream?token=${encodeURIComponent(token)}`;
  source = new EventSource(streamUrl);

  source.onopen = () => setStatus('live');

  source.onmessage = (message) => {
    let event;
    try {
      event = JSON.parse(message.data);
    } catch {
      return;
    }

    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Realtime listener failed:', error);
      }
    });
  };

  source.onerror = () => {
    setStatus('reconnecting');
    if (source && source.readyState === EventSource.CLOSED) {
      disconnectRealtime();
    }
  };
};

export const disconnectRealtime = () => {
  if (source) {
    source.close();
    source = null;
  }
  setStatus('idle');
};
