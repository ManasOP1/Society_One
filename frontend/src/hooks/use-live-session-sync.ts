import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { LIVE_SYNC_MS } from '@/constants/live-sync';
import { useAuth } from '@/context/auth';

/**
 * Keeps the resident session and TanStack Query cache in sync with the API
 * while the app is open — admin changes show up within a few seconds.
 */
export function useLiveSessionSync() {
  const queryClient = useQueryClient();
  const { isAuthenticated, refreshSession } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const sync = async () => {
      await refreshSession();
      await queryClient.refetchQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'session',
      });
    };

    const start = () => {
      void sync();
      if (!timer) timer = setInterval(() => void sync(), LIVE_SYNC_MS);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });

    if (AppState.currentState === 'active') start();

    return () => {
      stop();
      sub.remove();
    };
  }, [isAuthenticated, refreshSession, queryClient]);
}
