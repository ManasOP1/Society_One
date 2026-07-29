import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/context/auth';
import { useEvents, useNotices, useVisitors } from '@/hooks/queries';
import {
  loadSeenNotificationIds,
  saveSeenNotificationIds,
} from '@/utils/notification-reads';
import { unreadNotificationIds } from '@/utils/notification-unread';

type Listener = () => void;
const listeners = new Set<Listener>();

let sharedSeen = new Set<string>();
let sharedScope = '';
let sharedReady = false;
let sharedVersion = 0;

function emit() {
  sharedVersion += 1;
  listeners.forEach((l) => l());
}

function setSharedSeen(next: Set<string>, ready = true) {
  sharedSeen = next;
  sharedReady = ready;
  emit();
}

async function syncOsBadge(count: number) {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // Expo Go / web may not support badge APIs.
  }
}

/** Unread notices + events + flat visitors for the bell badge. */
export function useUnreadNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const societyId = user?.societyId ?? '';
  const notices = useNotices();
  const events = useEvents();
  const visitors = useVisitors();
  const [version, setVersion] = useState(sharedVersion);

  useEffect(() => {
    const onChange = () => setVersion(sharedVersion);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const itemIds = useMemo(() => {
    const noticeIds = (notices.data ?? []).map((n) => n.id).filter(Boolean);
    const eventIds = (events.data ?? []).map((e) => e.id).filter(Boolean);
    const visitorIds = (visitors.data ?? [])
      .map((v) => `visitor:${v.id}`)
      .filter(Boolean);
    return [...noticeIds, ...eventIds, ...visitorIds];
  }, [notices.data, events.data, visitors.data]);

  const itemKey = itemIds.join('|');
  const scope = `${userId}:${societyId}`;
  const listsLoaded =
    !notices.isPending && !events.isPending && !visitors.isPending;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!userId || !societyId) {
        sharedScope = '';
        setSharedSeen(new Set(), true);
        return;
      }

      if (!listsLoaded) return;

      if (sharedScope !== scope) {
        sharedScope = scope;
        sharedReady = false;
        emit();
      }

      const stored = await loadSeenNotificationIds(userId, societyId);
      if (cancelled) return;

      if (stored == null) {
        // First launch: seed current items as seen so only NEW ones show unread.
        const seed = new Set(itemIds);
        await saveSeenNotificationIds(userId, societyId, seed);
        if (cancelled) return;
        setSharedSeen(seed, true);
        return;
      }

      setSharedSeen(stored, true);
    })();

    return () => {
      cancelled = true;
    };
  }, [scope, userId, societyId, listsLoaded, itemKey, itemIds]);

  const unreadIds = useMemo(
    () => (sharedReady ? unreadNotificationIds(itemIds, sharedSeen) : []),
    // version must change whenever sharedSeen mutates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharedReady, itemKey, version],
  );

  const unreadCount = unreadIds.length;

  useEffect(() => {
    if (!sharedReady || Platform.OS === 'web') return;
    void syncOsBadge(unreadCount);
  }, [unreadCount, sharedReady, version]);

  const markRead = useCallback(
    async (id: string) => {
      if (!id || !userId || !societyId) return;
      if (sharedSeen.has(id)) return;
      const next = new Set(sharedSeen);
      next.add(id);
      setSharedSeen(next, true);
      await saveSeenNotificationIds(userId, societyId, next);
    },
    [userId, societyId],
  );

  const markAllRead = useCallback(async () => {
    if (!userId || !societyId) return;
    const next = new Set(sharedSeen);
    for (const id of itemIds) next.add(id);
    setSharedSeen(next, true);
    await saveSeenNotificationIds(userId, societyId, next);
  }, [userId, societyId, itemIds]);

  const isUnread = useCallback(
    (id: string) =>
      sharedReady && Boolean(id) && !sharedSeen.has(id) && itemIds.includes(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharedReady, itemKey, version],
  );

  return {
    unreadCount,
    unreadIds,
    isUnread,
    markRead,
    markAllRead,
    ready: sharedReady && listsLoaded,
  };
}
