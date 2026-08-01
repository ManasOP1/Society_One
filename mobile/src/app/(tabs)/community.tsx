import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { apiErrorMessage } from '@/api/client';
import type { SocietyEvent, SocietyNotice, SocietyVisitor } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useEvents, useNotices, useVisitors } from '@/hooks/queries';
import { isInitialLoad } from '@/hooks/query-ui';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { formatDate, formatDateTime, parseLocalDate } from '@/utils/format';

const TABS = ['All', 'Notices', 'Visitors', 'Events'] as const;
type Tab = (typeof TABS)[number];

type FeedItem =
  | { kind: 'notice'; id: string; sortAt: number; notice: SocietyNotice }
  | { kind: 'visitor'; id: string; sortAt: number; visitor: SocietyVisitor }
  | { kind: 'event'; id: string; sortAt: number; event: SocietyEvent };

export default function NotificationsScreen() {
  const [tab, setTab] = useState<Tab>('All');
  const { markAllRead, markRead, unreadCount, isUnread, ready } =
    useUnreadNotifications();
  const notices = useNotices();
  const events = useEvents();
  const visitors = useVisitors();
  const router = useRouter();
  const theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      void notices.refetch();
      void events.refetch();
      void visitors.refetch();
    }, [notices.refetch, events.refetch, visitors.refetch]),
  );

  const feed = useMemo(() => {
    const items: FeedItem[] = [
      ...(notices.data ?? []).map((notice) => ({
        kind: 'notice' as const,
        id: notice.id,
        sortAt: Date.parse(notice.publishedAt || notice.createdAt || '') || 0,
        notice,
      })),
      ...(visitors.data ?? []).map((visitor) => ({
        kind: 'visitor' as const,
        id: `visitor:${visitor.id}`,
        sortAt: Date.parse(visitor.checkInAt || visitor.createdAt || '') || 0,
        visitor,
      })),
      ...(events.data ?? []).map((event) => ({
        kind: 'event' as const,
        id: event.id,
        sortAt: Date.parse(event.date || event.createdAt || '') || 0,
        event,
      })),
    ];
    items.sort((a, b) => b.sortAt - a.sortAt);
    if (tab === 'Notices') return items.filter((i) => i.kind === 'notice');
    if (tab === 'Visitors') return items.filter((i) => i.kind === 'visitor');
    if (tab === 'Events') return items.filter((i) => i.kind === 'event');
    return items;
  }, [notices.data, visitors.data, events.data, tab]);

  const loading =
    isInitialLoad(notices) || isInitialLoad(events) || isInitialLoad(visitors);
  const error = notices.isError || events.isError || visitors.isError;

  return (
    <Screen topInset tabbed>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="title">Notifications</AppText>
          <AppText variant="caption" color="textSecondary">
            {ready && unreadCount > 0
              ? `${unreadCount} new update${unreadCount === 1 ? '' : 's'}`
              : 'Notices, visitors & events'}
          </AppText>
        </View>
        {ready && unreadCount > 0 ? (
          <Pressable
            onPress={() => void markAllRead()}
            hitSlop={8}
            style={({ pressed }) => [
              styles.markRead,
              { backgroundColor: theme.accentSoft },
              pressed && { opacity: 0.85 },
            ]}
          >
            <AppText variant="caption" style={{ color: Brand.ink, fontWeight: '600' }}>
              Mark all read
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <Segmented options={TABS} value={tab} onChange={setTab} />

      {loading ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <ErrorState
          message={apiErrorMessage(notices.error ?? events.error ?? visitors.error)}
          onRetry={() => {
            void notices.refetch();
            void events.refetch();
            void visitors.refetch();
          }}
        />
      ) : feed.length === 0 ? (
        <EmptyState
          icon="bell"
          title="You're all caught up"
          message="New notices and visitors for your flat will show up here."
        />
      ) : (
        <View style={styles.list}>
          {feed.map((item) => {
            if (item.kind === 'notice') {
              return (
                <NoticeRow
                  key={item.id}
                  notice={item.notice}
                  unread={isUnread(item.id)}
                  onOpen={() => void markRead(item.id)}
                />
              );
            }
            if (item.kind === 'visitor') {
              return (
                <VisitorRow
                  key={item.id}
                  visitor={item.visitor}
                  unread={isUnread(item.id)}
                  onPress={() => {
                    void markRead(item.id);
                    router.push('/visitors');
                  }}
                />
              );
            }
            return (
              <EventRow
                key={item.id}
                event={item.event}
                unread={isUnread(item.id)}
                onOpen={() => void markRead(item.id)}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function NoticeRow({
  notice,
  unread,
  onOpen,
}: {
  notice: SocietyNotice;
  unread: boolean;
  onOpen: () => void;
}) {
  const theme = useTheme();
  return (
    <Link href={{ pathname: '/notice/[id]', params: { id: notice.id } }} asChild>
      <Pressable onPress={onOpen} style={({ pressed }) => pressed && { opacity: 0.92 }}>
        <View
          style={[
            styles.row,
            { backgroundColor: theme.card, borderColor: theme.border },
            unread && styles.rowUnread,
          ]}
        >
          <View style={[styles.icon, { backgroundColor: theme.infoSoft }]}>
            <Feather name="bell" size={18} color={theme.info} />
          </View>
          <View style={styles.body}>
            <View style={styles.topLine}>
              <AppText variant="bodySemi" numberOfLines={1} style={{ flex: 1 }}>
                {notice.title}
              </AppText>
              {unread ? <View style={[styles.dot, { backgroundColor: theme.error }]} /> : null}
            </View>
            <AppText variant="caption" color="textSecondary" numberOfLines={2}>
              {notice.body}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Notice · {formatDate(notice.publishedAt)}
            </AppText>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function VisitorRow({
  visitor,
  unread,
  onPress,
}: {
  visitor: SocietyVisitor;
  unread: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const when = visitor.checkInAt
    ? formatDateTime(visitor.checkInAt)
    : formatDateTime(visitor.createdAt);
  const vehicle =
    visitor.vehicleNo
      ? `${visitor.vehicleType || ''} ${visitor.vehicleNo}`.trim()
      : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>
      <View
        style={[
          styles.row,
          { backgroundColor: theme.card, borderColor: theme.border },
          unread && styles.rowUnread,
        ]}
      >
        <View style={[styles.photo, { backgroundColor: theme.cardMuted }]}>
          {visitor.photoUrl ? (
            <Image source={{ uri: visitor.photoUrl }} style={styles.photoImg} />
          ) : (
            <Feather name="user" size={20} color={theme.textSecondary} />
          )}
        </View>
        <View style={styles.body}>
          <View style={styles.topLine}>
            <AppText variant="bodySemi" numberOfLines={1} style={{ flex: 1 }}>
              {visitor.name}
            </AppText>
            {unread ? <View style={[styles.dot, { backgroundColor: theme.error }]} /> : null}
          </View>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {[visitor.visitType || visitor.purpose, `Flat ${visitor.flat}`]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {[when, vehicle].filter(Boolean).join(' · ')}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

function EventRow({
  event,
  unread,
  onOpen,
}: {
  event: SocietyEvent;
  unread: boolean;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const date = parseLocalDate(event.date);
  const dayLabel = Number.isNaN(date.getTime()) ? '—' : String(date.getDate());
  const monthLabel = Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en', { month: 'short' });

  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable onPress={onOpen} style={({ pressed }) => pressed && { opacity: 0.92 }}>
        <View
          style={[
            styles.row,
            { backgroundColor: theme.card, borderColor: theme.border },
            unread && styles.rowUnread,
          ]}
        >
          <View style={[styles.dateBox, { backgroundColor: Brand.ink }]}>
            <AppText variant="bodySemi" style={{ color: Brand.lime }}>
              {dayLabel}
            </AppText>
            <AppText variant="caption" style={{ color: Brand.lime }}>
              {monthLabel}
            </AppText>
          </View>
          <View style={styles.body}>
            <View style={styles.topLine}>
              <AppText variant="bodySemi" numberOfLines={1} style={{ flex: 1 }}>
                {event.title}
              </AppText>
              {unread ? <View style={[styles.dot, { backgroundColor: theme.error }]} /> : null}
            </View>
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {event.location}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Event · {formatDate(event.date)}
            </AppText>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  headerText: { flex: 1, gap: 2 },
  markRead: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.onehalf,
    paddingVertical: 8,
  },
  list: { gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.onehalf,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.onehalf + 8,
  },
  rowUnread: {
    borderColor: Brand.lime,
    borderWidth: 1.5,
    backgroundColor: '#FAFDF0',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImg: { width: '100%', height: '100%' },
  dateBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2, minWidth: 0 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
