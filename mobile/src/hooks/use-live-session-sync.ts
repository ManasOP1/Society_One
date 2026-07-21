import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { LIVE_SYNC_DEBOUNCE_MS } from '@/constants/live-sync';
import { useAuth } from '@/context/auth';

/**
 * Refreshes the resident profile when the app returns to the foreground.
 * TanStack Query handles periodic data polling — this avoids duplicate intervals.
 */
export function useLiveSessionSync() {
  const queryClient = useQueryClient();
  const { isAuthenticated, refreshSession } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const sync = () => {
      void refreshSession();
      void queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'session',
        refetchType: 'active',
      });
    };

    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(sync, LIVE_SYNC_DEBOUNCE_MS);
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule();
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      sub.remove();
    };
  }, [isAuthenticated, refreshSession, queryClient]);
}
