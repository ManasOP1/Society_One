/**
 * Secure token persistence — expo-secure-store on iOS/Android,
 * localStorage fallback on web (SecureStore is unavailable there).
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'societyone.accessToken';
const REFRESH_KEY = 'societyone.refreshToken';
const USER_KEY = 'societyone.user';

const isWeb = Platform.OS === 'web';

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
  getAccessToken: () => getItem(ACCESS_KEY),
  getRefreshToken: () => getItem(REFRESH_KEY),
  getStoredUser: () => getItem(USER_KEY),

  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([setItem(ACCESS_KEY, accessToken), setItem(REFRESH_KEY, refreshToken)]);
  },

  saveUser: (userJson: string) => setItem(USER_KEY, userJson),

  async clear(): Promise<void> {
    await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY), deleteItem(USER_KEY)]);
  },
};
