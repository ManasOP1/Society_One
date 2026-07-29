import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { apiErrorMessage } from '@/api/client';
import type { SocietyEvent, SocietyNotice, SocietyVisitor } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { OutlineBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  const { markAllRead, unreadCount } = useUnreadNotifications();
  const notices = useNotices();
  const events = useEvents();
  const visitors = useVisitors();
  const { isUnread } = useUnreadNotifications();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      return () => {
        void markAllRead();
      };
    }, [markAllRead]),
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
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">Notifications</AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: -Spacing.one }}>
            Notices, visitors for your flat, and events
          </AppText>
        </View>
        {unreadCount > 0 ? (
          <Button
            title="Mark all read"
            variant="outline"
            onPress={() => void markAllRead()}
          />
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
          message="New notices and visitors for your room will show up here."
        />
      ) : (
        <View style={{ gap: Spacing.onehalf }}>
          {feed.map((item) => {
            if (item.kind === 'notice') {
              return (
                <NoticeRow
                  key={item.id}
                  notice={item.notice}
                  unread={isUnread(item.id)}
                />
              );
            }
            if (item.kind === 'visitor') {
              return (
                <VisitorNotifRow
                  key={item.id}
                  visitor={item.visitor}
                  unread={isUnread(item.id)}
                  onPress={() => router.push('/visitors')}
                />
              );
            }
            return (
              <EventRow
                key={item.id}
                event={item.event}
                unread={isUnread(item.id)}
              />
            );
          })}
        </View>
      )}

      {tab === 'All' ? (
        <AppText
          variant="caption"
          color="textSecondary"
          style={{ textAlign: 'center', marginTop: Spacing.one }}
        >
          Push alerts also arrive when a visitor checks in to your flat.
        </AppText>
      ) : null}
    </Screen>
  );
}

function NoticeRow({ notice, unread }: { notice: SocietyNotice; unread: boolean }) {
  const theme = useTheme();
  return (
    <Link href={{ pathname: '/notice/[id]', params: { id: notice.id } }} asChild>
      <Pressable>
        <Card style={[styles.card, unread && { borderColor: Brand.lime, borderWidth: 1.5 }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.infoSoft }]}>
              <Feather name="bell" size={18} color={theme.info} />
              {unread ? <View style={[styles.unreadDot, { backgroundColor: theme.error }]} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodySemi" numberOfLines={1}>
                {notice.title}
              </AppText>
              <AppText variant="caption" color="textSecondary" numberOfLines={2}>
                {notice.body}
              </AppText>
            </View>
            {unread ? (
              <OutlineBadge label="New" color={theme.error} />
            ) : notice.pinned ? (
              <OutlineBadge label="Pinned" icon="star" color={theme.warning} />
            ) : null}
          </View>
          <View style={styles.footer}>
            <AppText variant="caption" color="textSecondary">
              Notice
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {formatDate(notice.publishedAt)}
            </AppText>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

function VisitorNotifRow({
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
  return (
    <Pressable onPress={onPress}>
      <Card style={[styles.card, unread && { borderColor: Brand.lime, borderWidth: 1.5 }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: theme.successSoft, overflow: 'hidden' }]}>
            {visitor.photoUrl ? (
              <Image source={{ uri: visitor.photoUrl }} style={styles.thumb} />
            ) : (
              <Feather name="user-check" size={18} color={theme.success} />
            )}
            {unread ? <View style={[styles.unreadDot, { backgroundColor: theme.error }]} /> : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodySemi" numberOfLines={1}>
              {visitor.name} arrived
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={2}>
              {[visitor.visitType || visitor.purpose, visitor.companyName, `Flat ${visitor.flat}`]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
          {unread ? <OutlineBadge label="New" color={theme.error} /> : (
            <OutlineBadge label={visitor.status || 'Inside'} color={theme.success} />
          )}
        </View>
        <View style={styles.footer}>
          <AppText variant="caption" color="textSecondary">
            Visitor
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {when}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}

function EventRow({ event, unread }: { event: SocietyEvent; unread: boolean }) {
  const theme = useTheme();
  const date = parseLocalDate(event.date);
  const dayLabel = Number.isNaN(date.getTime()) ? '—' : String(date.getDate());
  const monthLabel = Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en', { month: 'short' });
  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable>
        <Card style={[styles.card, unread && { borderColor: Brand.lime, borderWidth: 1.5 }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.dateBox, { backgroundColor: theme.surfaceDark }]}>
              <AppText variant="heading" style={{ color: theme.accent }}>
                {dayLabel}
              </AppText>
              <AppText variant="caption" style={{ color: theme.accent }}>
                {monthLabel}
              </AppText>
              {unread ? <View style={[styles.unreadDot, { backgroundColor: theme.error }]} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodySemi" numberOfLines={1}>
                {event.title}
              </AppText>
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {event.location}
              </AppText>
            </View>
            {unread ? (
              <OutlineBadge label="New" color={theme.error} />
            ) : (
              <OutlineBadge label={event.status} />
            )}
          </View>
          <View style={styles.footer}>
            <AppText variant="caption" color="textSecondary">
              Event
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {formatDate(event.date)}
            </AppText>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  card: { gap: Spacing.one },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.onehalf },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 48, height: 48 },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dateBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
