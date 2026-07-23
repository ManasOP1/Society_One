import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/auth';
import { useEvents, useNotices } from '@/hooks/queries';
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

function emit() {
  listeners.forEach((l) => l());
}

function setSharedSeen(next: Set<string>, ready = true) {
  sharedSeen = next;
  sharedReady = ready;
  emit();
}

/** Unread society notices + events for the bell badge (shared across screens). */
export function useUnreadNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const societyId = user?.societyId ?? '';
  const notices = useNotices();
  const events = useEvents();
  const [, bump] = useState(0);

  useEffect(() => {
    const onChange = () => bump((n) => n + 1);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const itemIds = useMemo(() => {
    const noticeIds = (notices.data ?? []).map((n) => n.id).filter(Boolean);
    const eventIds = (events.data ?? []).map((e) => e.id).filter(Boolean);
    return [...noticeIds, ...eventIds];
  }, [notices.data, events.data]);

  const itemKey = itemIds.join('|');
  const scope = `${userId}:${societyId}`;
  const listsLoaded = !notices.isPending && !events.isPending;

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
    // bump included so sharedSeen mutations recompute
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharedReady, itemKey, bump],
  );

  const unreadCount = unreadIds.length;

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
    (id: string) => sharedReady && Boolean(id) && !sharedSeen.has(id) && itemIds.includes(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharedReady, itemKey, bump],
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
