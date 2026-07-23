/**
 * Auth session provider. Restores the session from secure storage on launch,
 * exposes login/logout, and signs the user out when token refresh fails.
 */

import { isAxiosError } from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiErrorMessage, setSessionExpiredListener } from '@/api/client';
import { authApi, type ResidentLoginInput } from '@/api/endpoints';
import { tokenStore } from '@/api/token-store';
import type { AuthUser } from '@/api/types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True while the stored session is being restored on app launch. */
  isRestoring: boolean;
  login: (input: ResidentLoginInput) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  /** Pull latest profile + flat info from the API (used by live sync). */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isAuthUserShape(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const u = value as Record<string, unknown>;
  return (
    typeof u.id === 'string' &&
    typeof u.societyId === 'string' &&
    (u.role === 'resident' || u.role === 'admin')
  );
}

function isAuthFailure(error: unknown): boolean {
  return isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const clearSessionCache = useCallback(() => {
    queryClient.removeQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'session',
    });
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [token, storedUser] = await Promise.all([
          tokenStore.getRefreshToken(),
          tokenStore.getStoredUser(),
        ]);
        if (!token || !storedUser) return;

        let parsed: unknown;
        try {
          parsed = JSON.parse(storedUser);
        } catch {
          await tokenStore.clear();
          return;
        }

        if (!isAuthUserShape(parsed) || parsed.role !== 'resident') {
          await tokenStore.clear();
          return;
        }

        // Optimistic restore so UI can paint, then validate against the API.
        if (!cancelled) setUser(parsed);
        try {
          const me = await authApi.me();
          if (cancelled) return;
          if (me.role !== 'resident') {
            await tokenStore.clear();
            setUser(null);
            return;
          }
          await tokenStore.saveUser(JSON.stringify(me));
          setUser(me);
        } catch (error) {
          // Only clear on auth failures — keep optimistic session on network/5xx.
          if (isAuthFailure(error)) {
            await tokenStore.clear();
            if (!cancelled) setUser(null);
          }
        }
      } catch {
        /* corrupt session — stay logged out */
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredListener(() => {
      clearSessionCache();
      setUser(null);
    });
    return () => setSessionExpiredListener(null);
  }, [clearSessionCache]);

  const login = useCallback(
    async (input: ResidentLoginInput) => {
      try {
        clearSessionCache();
        const { accessToken, refreshToken, user: loggedIn } = await authApi.loginResident(input);
        if (loggedIn.role !== 'resident') {
          return {
            error: 'This app is for residents only. Society admins should use the web console.',
          };
        }
        await tokenStore.saveTokens(accessToken, refreshToken);
        await tokenStore.saveUser(JSON.stringify(loggedIn));
        setUser(loggedIn);
        return { error: null };
      } catch (error) {
        return { error: apiErrorMessage(error) };
      }
    },
    [clearSessionCache]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* revoke best-effort */
    }
    await tokenStore.clear();
    clearSessionCache();
    setUser(null);
  }, [clearSessionCache]);

  const refreshSession = useCallback(async () => {
    try {
      const token = await tokenStore.getRefreshToken();
      if (!token) return;
      const me = await authApi.me();
      if (me.role !== 'resident') {
        await tokenStore.clear();
        clearSessionCache();
        setUser(null);
        return;
      }
      await tokenStore.saveUser(JSON.stringify(me));
      setUser(me);
    } catch (error) {
      if (isAuthFailure(error)) {
        await tokenStore.clear();
        clearSessionCache();
        setUser(null);
      }
    }
  }, [clearSessionCache]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, isRestoring, login, logout, refreshSession }),
    [user, isRestoring, login, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
