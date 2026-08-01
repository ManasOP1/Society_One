/**
 * Persists which notification IDs the resident has already seen.
 *
 * Storage shape (v1):
 *   { "v": 1, "seeded": true, "ids": ["noticeId", "visitor:…", …] }
 *
 * Legacy shape (array of ids) is migrated on read.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export { unreadNotificationIds } from '@/utils/notification-unread';

const PREFIX = 'societyone.notifSeen.v1.';

export type SeenStore = {
  seeded: boolean;
  ids: Set<string>;
};

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
      /* ignore quota */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

function storageKey(userId: string, societyId: string) {
  return `${PREFIX}${userId}.${societyId}`;
}

function parseIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0));
}

export async function loadSeenStore(
  userId: string,
  societyId: string,
): Promise<SeenStore | null> {
  if (!userId || !societyId) return { seeded: true, ids: new Set() };

  const raw = await readRaw(storageKey(userId, societyId));
  // Also try legacy key once for migration.
  const legacyKey = `societyone.notifSeen.${userId}.${societyId}`;
  const legacyRaw = raw == null ? await readRaw(legacyKey) : null;
  const payload = raw ?? legacyRaw;
  if (payload == null) return null;

  try {
    const parsed = JSON.parse(payload) as unknown;
    if (Array.isArray(parsed)) {
      // Legacy: bare id array. Empty array was often a race seed — treat as unseeded
      // so we can baseline properly on next hydrate with real item ids.
      if (parsed.length === 0) return null;
      return { seeded: true, ids: parseIds(parsed) };
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as { v?: number; seeded?: boolean; ids?: unknown };
      return {
        seeded: obj.seeded === true,
        ids: parseIds(obj.ids),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveSeenStore(
  userId: string,
  societyId: string,
  store: SeenStore,
): Promise<void> {
  if (!userId || !societyId) return;
  await writeRaw(
    storageKey(userId, societyId),
    JSON.stringify({
      v: 1,
      seeded: store.seeded,
      ids: [...store.ids],
    }),
  );
}
