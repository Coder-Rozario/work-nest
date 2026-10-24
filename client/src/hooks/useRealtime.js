import { useEffect, useRef } from 'react';
import { subscribeRealtime } from '../services/realtime';

/**
 * Runs `onUpdate` whenever the server reports a change on a watched resource.
 * @param {string|string[]} resources resource channels, e.g. "messages" or ["tasks", "projects"]
 * @param {(event: object) => void} onUpdate refresh handler for the page
 */
export const useRealtime = (resources, onUpdate) => {
  const handlerRef = useRef(onUpdate);
  const channels = Array.isArray(resources) ? resources.join('|') : String(resources || '');

  useEffect(() => {
    handlerRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const watched = channels ? channels.split('|') : [];
    if (!watched.length) return undefined;

    return subscribeRealtime((event) => {
      if (!event?.resource) return;
      if (watched.includes('*') || watched.includes(event.resource)) {
        handlerRef.current?.(event);
      }
    });
  }, [channels]);
};

export default useRealtime;
