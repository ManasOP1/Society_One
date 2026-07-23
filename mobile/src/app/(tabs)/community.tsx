import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { apiErrorMessage } from '@/api/client';
import type { SocietyEvent, SocietyNotice } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { OutlineBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SearchField } from '@/components/ui/search-field';
import { Segmented } from '@/components/ui/segmented';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useEvents, useNotices } from '@/hooks/queries';
import { isInitialLoad } from '@/hooks/query-ui';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { formatDate, parseLocalDate } from '@/utils/format';

const TABS = ['Notices', 'Events'] as const;
type Tab = (typeof TABS)[number];

export default function CommunityScreen() {
  const [tab, setTab] = useState<Tab>('Notices');
  const [search, setSearch] = useState('');
  const { markAllRead } = useUnreadNotifications();

  // Leaving Community after viewing = notifications read → clear bell badge.
  useFocusEffect(
    useCallback(() => {
      return () => {
        void markAllRead();
      };
    }, [markAllRead]),
  );

  const props = { tab, setTab, search, setSearch };
  return tab === 'Notices' ? <NoticesTab {...props} /> : <EventsTab {...props} />;
}

type HeaderProps = {
  tab: Tab;
  setTab: (t: Tab) => void;
  search: string;
  setSearch: (s: string) => void;
};

function Header({ tab, setTab, search, setSearch }: HeaderProps) {
  return (
    <>
      <AppText variant="title">Community</AppText>
      <SearchField value={search} onChangeText={setSearch} placeholder={`Search ${tab.toLowerCase()}...`} />
      <Segmented options={TABS} value={tab} onChange={setTab} />
    </>
  );
}

function matches(search: string, ...fields: string[]) {
  const q = search.trim().toLowerCase();
  return !q || fields.some((f) => f.toLowerCase().includes(q));
}

/* -------------------------------- Notices ------------------------------- */

function NoticesTab(props: HeaderProps) {
  const notices = useNotices();
  const { isUnread } = useUnreadNotifications();
  const filtered = useMemo(
    () => (notices.data ?? []).filter((n) => matches(props.search, n.title, n.body)),
    [notices.data, props.search]
  );
  return (
    <Screen topInset tabbed>
      <Header {...props} />
      {isInitialLoad(notices) ? (
        <ListSkeleton rows={4} />
      ) : notices.isError ? (
        <ErrorState message={apiErrorMessage(notices.error)} onRetry={() => notices.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notices"
          message={props.search ? 'No notices match your search.' : 'Society announcements will appear here.'}
        />
      ) : (
        <View style={{ gap: Spacing.onehalf }}>
          {filtered.map((notice) => (
            <NoticeRow key={notice.id} notice={notice} unread={isUnread(notice.id)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function NoticeRow({ notice, unread }: { notice: SocietyNotice; unread: boolean }) {
  const theme = useTheme();
  return (
    <Link href={{ pathname: '/notice/[id]', params: { id: notice.id } }} asChild>
      <Pressable>
        <Card style={{ gap: Spacing.onehalf }}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.cardMuted }]}>
              <Feather name="bell" size={18} color={theme.text} />
              {unread ? <View style={[styles.unreadDot, { backgroundColor: theme.error }]} /> : null}
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="bodySemi" numberOfLines={1}>
                {notice.title}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                Society Office
              </AppText>
            </View>
            {notice.pinned ? (
              <OutlineBadge label="Pinned" icon="star" color={theme.warning} />
            ) : unread ? (
              <OutlineBadge label="New" color={theme.error} />
            ) : (
              <OutlineBadge label="Published" />
            )}
          </View>
          <AppText variant="body" color="textSecondary" numberOfLines={2}>
            {notice.body}
          </AppText>
          <View style={styles.cardFooter}>
            <View style={[styles.categoryChip, { backgroundColor: theme.cardMuted }]}>
              <AppText variant="caption" color="textSecondary">
                Notice
              </AppText>
            </View>
            <View style={styles.timeRow}>
              <Feather name="clock" size={13} color={theme.textSecondary} />
              <AppText variant="caption" color="textSecondary">
                {formatDate(notice.publishedAt)}
              </AppText>
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

/* --------------------------------- Events ------------------------------- */

function EventsTab(props: HeaderProps) {
  const events = useEvents();
  const { isUnread } = useUnreadNotifications();
  const filtered = useMemo(
    () => (events.data ?? []).filter((e) => matches(props.search, e.title, e.location, e.description)),
    [events.data, props.search]
  );
  return (
    <Screen topInset tabbed>
      <Header {...props} />
      {isInitialLoad(events) ? (
        <ListSkeleton rows={4} />
      ) : events.isError ? (
        <ErrorState message={apiErrorMessage(events.error)} onRetry={() => events.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No events"
          message={props.search ? 'No events match your search.' : 'Society events will appear here.'}
        />
      ) : (
        <View style={{ gap: Spacing.onehalf }}>
          {filtered.map((event) => (
            <EventRow key={event.id} event={event} unread={isUnread(event.id)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function EventRow({ event, unread }: { event: SocietyEvent; unread: boolean }) {
  const theme = useTheme();
  const date = parseLocalDate(event.date);
  const dayLabel = Number.isNaN(date.getTime()) ? '—' : String(date.getDate());
  const monthLabel = Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en', { month: 'short' });
  const done = event.status === 'Completed';
  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable>
        <Card style={{ gap: Spacing.onehalf }}>
          <View style={styles.cardHeader}>
            <View style={[styles.dateBox, { backgroundColor: done ? theme.cardMuted : theme.surfaceDark }]}>
              <AppText variant="heading" style={{ color: done ? theme.textSecondary : theme.accent }}>
                {dayLabel}
              </AppText>
              <AppText variant="caption" style={{ color: done ? theme.textSecondary : theme.accent }}>
                {monthLabel}
              </AppText>
              {unread ? <View style={[styles.unreadDot, { backgroundColor: theme.error }]} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodySemi" numberOfLines={1}>
                {event.title}
              </AppText>
              <View style={styles.timeRow}>
                <Feather name="map-pin" size={12} color={theme.textSecondary} />
                <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                  {event.location}
                </AppText>
              </View>
            </View>
            <OutlineBadge
              label={unread ? 'New' : event.status}
              icon={
                unread
                  ? 'bell'
                  : done
                    ? 'check-circle'
                    : event.status === 'Ongoing'
                      ? 'zap'
                      : 'clock'
              }
              color={
                unread
                  ? theme.error
                  : done
                    ? undefined
                    : event.status === 'Ongoing'
                      ? theme.success
                      : theme.text
              }
            />
          </View>
          <View style={styles.cardFooter}>
            <View style={[styles.categoryChip, { backgroundColor: theme.cardMuted }]}>
              <AppText variant="caption" color="textSecondary">
                Event
              </AppText>
            </View>
            <View style={styles.timeRow}>
              <Feather name="clock" size={13} color={theme.textSecondary} />
              <AppText variant="caption" color="textSecondary">
                {formatDate(event.date)}
              </AppText>
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.onehalf },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.onehalf,
    paddingVertical: 5,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
