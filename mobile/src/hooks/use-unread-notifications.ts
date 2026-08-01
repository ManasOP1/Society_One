import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/context/auth';
import { useEvents, useNotices, useVisitors } from '@/hooks/queries';
import { loadSeenStore, saveSeenStore } from '@/utils/notification-reads';
import { unreadNotificationIds } from '@/utils/notification-unread';

type Listener = () => void;
const listeners = new Set<Listener>();

let sharedSeen = new Set<string>();
let sharedScope = '';
let sharedReady = false;
let sharedHydrated = false;
let sharedVersion = 0;

function emit() {
  sharedVersion += 1;
  listeners.forEach((l) => l());
}

function setSharedState(next: {
  seen?: Set<string>;
  ready?: boolean;
  hydrated?: boolean;
  scope?: string;
}) {
  if (next.seen) sharedSeen = next.seen;
  if (typeof next.ready === 'boolean') sharedReady = next.ready;
  if (typeof next.hydrated === 'boolean') sharedHydrated = next.hydrated;
  if (typeof next.scope === 'string') sharedScope = next.scope;
  emit();
}

async function syncOsBadge(count: number) {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    /* Expo Go / web */
  }
}

/**
 * Unread notices + events + flat visitors for the bell badge.
 *
 * Fixes the “count flashes then disappears on app open” bug:
 * - Hydrate from disk once per user/society (not on every refetch)
 * - Never baseline-seed while the feed is still empty, then re-seed as read
 * - After hydrate, only markRead / markAllRead can clear the badge
 */
export function useUnreadNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const societyId = user?.societyId ?? '';
  const notices = useNotices();
  const events = useEvents();
  const visitors = useVisitors();
  const [version, setVersion] = useState(sharedVersion);
  const hydrateGen = useRef(0);

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

  const itemCount = itemIds.length;
  const scope = `${userId}:${societyId}`;
  const listsLoaded =
    !notices.isPending && !events.isPending && !visitors.isPending;
  const stillFetching =
    notices.isFetching || events.isFetching || visitors.isFetching;

  useEffect(() => {
    if (!userId || !societyId) {
      hydrateGen.current += 1;
      setSharedState({
        seen: new Set(),
        ready: true,
        hydrated: false,
        scope: '',
      });
      return;
    }

    if (!listsLoaded) return;

    // Already hydrated for this login scope — keep in-memory seen (includes markRead).
    if (sharedHydrated && sharedScope === scope) return;

    // Prevent empty-seed race: queries settled pending=false but refetch still
    // filling data → wait; otherwise we'd save [] then show everyone as unread
    // and later wipe the badge when a bad reseed ran.
    if (itemCount === 0 && stillFetching) return;

    const gen = ++hydrateGen.current;
    let cancelled = false;

    (async () => {
      setSharedState({ ready: false, scope });

      const stored = await loadSeenStore(userId, societyId);
      if (cancelled || gen !== hydrateGen.current) return;

      if (stored == null) {
        const seed = new Set(itemIds);
        await saveSeenStore(userId, societyId, { seeded: true, ids: seed });
        if (cancelled || gen !== hydrateGen.current) return;
        setSharedState({
          seen: seed,
          ready: true,
          hydrated: true,
          scope,
        });
        return;
      }

      setSharedState({
        seen: stored.ids,
        ready: true,
        hydrated: true,
        scope,
      });
    })().catch(() => {
      if (cancelled || gen !== hydrateGen.current) return;
      setSharedState({
        seen: new Set(),
        ready: true,
        hydrated: true,
        scope,
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, userId, societyId, listsLoaded, itemCount, stillFetching]);

  const unreadIds = useMemo(
    () => (sharedReady ? unreadNotificationIds(itemIds, sharedSeen) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharedReady, itemIds.join('|'), version],
  );

  const unreadCount = sharedReady ? unreadIds.length : 0;

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
      setSharedState({ seen: next, ready: true, hydrated: true });
      await saveSeenStore(userId, societyId, { seeded: true, ids: next });
    },
    [userId, societyId],
  );

  const markAllRead = useCallback(async () => {
    if (!userId || !societyId) return;
    const next = new Set(sharedSeen);
    for (const id of itemIds) next.add(id);
    setSharedState({ seen: next, ready: true, hydrated: true });
    await saveSeenStore(userId, societyId, { seeded: true, ids: next });
  }, [userId, societyId, itemIds]);

  const isUnread = useCallback(
    (id: string) =>
      sharedReady && Boolean(id) && !sharedSeen.has(id) && itemIds.includes(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharedReady, itemIds.join('|'), version],
  );

  return {
    unreadCount,
    unreadIds,
    isUnread,
    markRead,
    markAllRead,
    ready: sharedReady && listsLoaded && sharedHydrated,
  };
}
