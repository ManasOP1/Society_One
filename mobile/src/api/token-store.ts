/**
 * Secure token persistence — expo-secure-store on iOS/Android,
 * localStorage fallback on web (SecureStore is unavailable there).
 *
 * Access/refresh tokens are kept in a process memory cache so Axios
 * interceptors do not hit SecureStore on every request.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'societyone.accessToken';
const REFRESH_KEY = 'societyone.refreshToken';
const USER_KEY = 'societyone.user';

const isWeb = Platform.OS === 'web';

const memory: {
  accessToken: string | null | undefined;
  refreshToken: string | null | undefined;
  user: string | null | undefined;
} = {
  accessToken: undefined,
  refreshToken: undefined,
  user: undefined,
};

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* private mode */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStore = {
  async getAccessToken(): Promise<string | null> {
    if (memory.accessToken !== undefined) return memory.accessToken;
    const value = await getItem(ACCESS_KEY);
    memory.accessToken = value;
    return value;
  },

  async getRefreshToken(): Promise<string | null> {
    if (memory.refreshToken !== undefined) return memory.refreshToken;
    const value = await getItem(REFRESH_KEY);
    memory.refreshToken = value;
    return value;
  },

  async getStoredUser(): Promise<string | null> {
    if (memory.user !== undefined) return memory.user;
    const value = await getItem(USER_KEY);
    memory.user = value;
    return value;
  },

  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    memory.accessToken = accessToken;
    memory.refreshToken = refreshToken;
    await Promise.all([setItem(ACCESS_KEY, accessToken), setItem(REFRESH_KEY, refreshToken)]);
  },

  async saveUser(userJson: string): Promise<void> {
    memory.user = userJson;
    await setItem(USER_KEY, userJson);
  },

  async clear(): Promise<void> {
    memory.accessToken = null;
    memory.refreshToken = null;
    memory.user = null;
    await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY), deleteItem(USER_KEY)]);
  },
};
