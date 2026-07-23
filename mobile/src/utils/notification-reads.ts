/**
 * Persists which notice/event IDs the resident has already seen.
 * First launch seeds current IDs so existing history does not flood the badge.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export { unreadNotificationIds } from '@/utils/notification-unread';

const PREFIX = 'societyone.notifSeen.';

async function readRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function writeRaw(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* ignore */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

function storageKey(userId: string, societyId: string) {
  return `${PREFIX}${userId}.${societyId}`;
}

export async function loadSeenNotificationIds(
  userId: string,
  societyId: string,
): Promise<Set<string> | null> {
  if (!userId || !societyId) return new Set();
  const raw = await readRaw(storageKey(userId, societyId));
  if (raw == null) return null; // first launch — caller should seed
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export async function saveSeenNotificationIds(
  userId: string,
  societyId: string,
  ids: Set<string>,
): Promise<void> {
  if (!userId || !societyId) return;
  await writeRaw(storageKey(userId, societyId), JSON.stringify([...ids]));
}
