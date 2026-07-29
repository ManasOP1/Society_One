import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { apiErrorMessage } from '@/api/client';
import type { SocietyVisitor } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { OutlineBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useVisitors } from '@/hooks/queries';
import { isInitialLoad } from '@/hooks/query-ui';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/utils/format';

const FILTERS = ['All', 'Visitors', 'Parcel', 'Helpers'] as const;
type Filter = (typeof FILTERS)[number];

function categoryOf(visitor: SocietyVisitor): Exclude<Filter, 'All'> {
  const p = `${visitor.name} ${visitor.purpose} ${visitor.visitType ?? ''}`.toLowerCase();
  if (
    p.includes('delivery') ||
    p.includes('parcel') ||
    p.includes('food') ||
    p.includes('courier') ||
    p.includes('grocery') ||
    p.includes('shopping')
  ) {
    return 'Parcel';
  }
  if (
    p.includes('help') ||
    p.includes('maid') ||
    p.includes('repair') ||
    p.includes('work') ||
    p.includes('plumb') ||
    p.includes('driver') ||
    p.includes('electrician') ||
    p.includes('housekeeping') ||
    p.includes('maintenance')
  ) {
    return 'Helpers';
  }
  return 'Visitors';
}

function iconFor(category: Exclude<Filter, 'All'>): keyof typeof Feather.glyphMap {
  if (category === 'Parcel') return 'package';
  if (category === 'Helpers') return 'tool';
  return 'user';
}

function checkInLabel(visitor: SocietyVisitor): string {
  if (visitor.checkInAt) return formatDateTime(visitor.checkInAt);
  if (visitor.createdAt) return formatDateTime(visitor.createdAt);
  return visitor.expectedTime || '—';
}

export default function VisitorsScreen() {
  const visitors = useVisitors();
  const [filter, setFilter] = useState<Filter>('All');

  const filtered = useMemo(
    () => (visitors.data ?? []).filter((v) => filter === 'All' || categoryOf(v) === filter),
    [visitors.data, filter]
  );

  return (
    <Screen topInset tabbed>
      <AppText variant="title">Visitors</AppText>
      <AppText variant="body" color="textSecondary" style={{ marginTop: -Spacing.one }}>
        Entries for your flat only
      </AppText>

      <Segmented options={FILTERS} value={filter} onChange={setFilter} />

      {isInitialLoad(visitors) ? (
        <ListSkeleton rows={5} />
      ) : visitors.isError ? (
        <ErrorState message={apiErrorMessage(visitors.error)} onRetry={() => visitors.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="users"
          title="No entries"
          message={
            filter === 'All'
              ? 'Gate check-ins for your flat will appear here.'
              : 'Nothing in this category yet.'
          }
        />
      ) : (
        <View style={{ gap: Spacing.two }}>
          {filtered.map((visitor) => (
            <VisitorRow key={visitor.id} visitor={visitor} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function VisitorRow({ visitor }: { visitor: SocietyVisitor }) {
  const theme = useTheme();
  const category = categoryOf(visitor);
  const vehicle =
    visitor.vehicleNo
      ? `${visitor.vehicleType || ''} ${visitor.vehicleNo}`.trim()
      : visitor.vehicle && visitor.vehicle !== '—'
        ? visitor.vehicle
        : null;
  const purpose = [visitor.visitType || visitor.purpose, visitor.companyName]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.photoBox, { backgroundColor: theme.cardMuted }]}>
          {visitor.photoUrl ? (
            <Image
              source={{ uri: visitor.photoUrl }}
              style={styles.photo}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Feather name={iconFor(category)} size={22} color={theme.textSecondary} />
          )}
        </View>

        <View style={styles.main}>
          <View style={styles.nameRow}>
            <AppText variant="bodySemi" numberOfLines={1} style={{ flex: 1 }}>
              {visitor.name}
            </AppText>
            <OutlineBadge label={visitor.status || 'Inside'} color={theme.success} />
          </View>
          <AppText variant="caption" color="textSecondary" numberOfLines={2}>
            {purpose}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            Flat {visitor.flat}
          </AppText>
        </View>
      </View>

      <View style={[styles.metaBar, { backgroundColor: theme.cardMuted }]}>
        {visitor.passNumber ? (
          <View style={styles.metaItem}>
            <Feather name="hash" size={12} color={theme.textSecondary} />
            <AppText variant="caption" color="textSecondary">
              {visitor.passNumber}
            </AppText>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <Feather name="clock" size={12} color={Brand.ink} />
          <AppText variant="caption" style={{ color: Brand.ink, fontWeight: '600' }}>
            {checkInLabel(visitor)}
          </AppText>
        </View>
        {vehicle ? (
          <View style={styles.metaItem}>
            <Feather name="truck" size={12} color={theme.textSecondary} />
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {vehicle}
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.onehalf, padding: Spacing.two },
  topRow: { flexDirection: 'row', gap: Spacing.onehalf, alignItems: 'flex-start' },
  photoBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  main: { flex: 1, gap: 3, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  metaBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.onehalf,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.onehalf,
    paddingVertical: Spacing.one,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
