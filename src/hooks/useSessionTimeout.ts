import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getSessionTimeout } from '@/utils/settings';

/**
 * Watches AppState transitions. When the app returns from background,
 * if the time in background exceeded the configured session timeout,
 * it calls the provided onTimeout callback (intended to trigger logout).
 */
export function useSessionTimeout(onTimeout: () => void) {
  const backgroundedAt = useRef<number | null>(null);
  const timeoutMinutes = useRef<number>(0);

  // Read the setting once on mount; it's re-read whenever the app foregrounds too.
  useEffect(() => {
    getSessionTimeout().then((v) => { timeoutMinutes.current = v; });
  }, []);

  const handleAppStateChange = useCallback(
    async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
        // Re-read setting in case it was changed while the app was active
        timeoutMinutes.current = await getSessionTimeout();
      } else if (nextState === 'active') {
        const t = timeoutMinutes.current;
        const bg = backgroundedAt.current;
        if (t > 0 && bg !== null) {
          const elapsed = (Date.now() - bg) / 60_000; // minutes
          if (elapsed >= t) {
            onTimeout();
          }
        }
        backgroundedAt.current = null;
      }
    },
    [onTimeout]
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [handleAppStateChange]);
}
