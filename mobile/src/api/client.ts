/**
 * Central typed API client.
 *
 * - Base URL from EXPO_PUBLIC_API_BASE_URL (see .env) — this should point at
 *   the live Nest API (`http://<host>:4000/api/v1`).
 * - The in-app mock backend is OFF by default. It only activates when
 *   EXPO_PUBLIC_USE_MOCK=true is explicitly set (offline UI demos only) —
 *   real usage always requires a configured, reachable API URL so the app
 *   never silently falls back to fake data.
 * - Attaches the Bearer access token from secure storage.
 * - On 401, refreshes the token once (single-flight) and retries the request;
 *   if the refresh fails, the session-expired listener signs the user out.
 */

import axios, { AxiosError, isAxiosError, type InternalAxiosRequestConfig } from 'axios';

import { mockAdapter } from '@/api/mock/adapter';
import { tokenStore } from '@/api/token-store';
import type { AuthTokens } from '@/api/types';

// eslint-disable-next-line import/no-named-as-default-member -- axios types only expose `create` on the default export
const { create } = axios;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || '';
/** Explicit opt-in only — never an automatic fallback for a missing API URL. */
export const IS_MOCK_API = process.env.EXPO_PUBLIC_USE_MOCK?.trim().toLowerCase() === 'true';

if (!API_BASE_URL && !IS_MOCK_API) {
  // eslint-disable-next-line no-console -- surfaced deliberately: no silent fallback to fake data
  console.error(
    '[SocietyOne] EXPO_PUBLIC_API_BASE_URL is not set and EXPO_PUBLIC_USE_MOCK is not "true". ' +
      'The app has no data source — set EXPO_PUBLIC_API_BASE_URL to your Nest API (e.g. http://192.168.1.239:4000/api/v1) ' +
      'in mobile/.env, or set EXPO_PUBLIC_USE_MOCK=true for an offline demo with fake data.'
  );
} else if (IS_MOCK_API) {
  // eslint-disable-next-line no-console -- make demo mode obvious in logs
  console.warn('[SocietyOne] EXPO_PUBLIC_USE_MOCK=true — using the in-app mock backend. No real data.');
}

export const api = create({
  baseURL: API_BASE_URL || 'http://mock.societyone.local',
  /** Allow Render free-tier cold starts (~30–50s) without failing first login. */
  timeout: 45_000,
  headers: { 'Content-Type': 'application/json' },
  ...(IS_MOCK_API ? { adapter: mockAdapter } : {}),
});

/* ---- request: attach access token ---- */

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

/* ---- response: auto-refresh on 401, retry once ---- */

let onSessionExpired: (() => void) | null = null;

/** Registered by the auth provider; called when refresh fails. */
export function setSessionExpiredListener(listener: (() => void) | null) {
  onSessionExpired = listener;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokenStore.getRefreshToken();
  if (!refreshToken) return null;
  try {
    // Bare client: no interceptors, so a failing refresh can't loop.
    const bare = create({
      baseURL: api.defaults.baseURL,
      timeout: 15_000,
      ...(IS_MOCK_API ? { adapter: mockAdapter } : {}),
    });
    const { data } = await bare.post<AuthTokens>('/auth/refresh', { refreshToken });
    await tokenStore.saveTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthRoute = config?.url?.includes('/auth/');

    if (error.response?.status === 401 && config && !config._retried && !isAuthRoute) {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;

      if (newToken) {
        config._retried = true;
        config.headers.set('Authorization', `Bearer ${newToken}`);
        return api.request(config);
      }

      await tokenStore.clear();
      onSessionExpired?.();
    }

    return Promise.reject(error);
  }
);

/** Human-readable message from any API error. */
export function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    if (!error.response) return 'Cannot reach the server. Check your connection.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
