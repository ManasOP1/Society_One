import { Feather } from '@expo/vector-icons';
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
import { Radius, Spacing } from '@/constants/theme';
import { useVisitors } from '@/hooks/queries';
import { isInitialLoad } from '@/hooks/query-ui';
import { useTheme } from '@/hooks/use-theme';

const FILTERS = ['All', 'Visitors', 'Parcel', 'Helpers'] as const;
type Filter = (typeof FILTERS)[number];

function categoryOf(visitor: SocietyVisitor): Exclude<Filter, 'All'> {
  const p = `${visitor.name} ${visitor.purpose}`.toLowerCase();
  if (p.includes('delivery') || p.includes('parcel') || p.includes('food') || p.includes('courier')) {
    return 'Parcel';
  }
  if (p.includes('help') || p.includes('maid') || p.includes('repair') || p.includes('work') || p.includes('plumb') || p.includes('driver')) {
    return 'Helpers';
  }
  return 'Visitors';
}

function iconFor(category: Exclude<Filter, 'All'>): keyof typeof Feather.glyphMap {
  if (category === 'Parcel') return 'package';
  if (category === 'Helpers') return 'tool';
  return 'user';
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
        Today's entries at your society gate
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
          message={filter === 'All' ? 'Gate entries will appear here as they happen.' : 'Nothing in this category yet.'}
        />
      ) : (
        <View style={{ gap: Spacing.onehalf }}>
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
  return (
    <Card style={{ gap: Spacing.onehalf }}>
      <View style={styles.row}>
        <View style={[styles.photoBox, { backgroundColor: theme.cardMuted }]}>
          <Feather name={iconFor(category)} size={22} color={theme.text} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodySemi" numberOfLines={1}>
            {visitor.name}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {visitor.purpose} · Flat {visitor.flat}
          </AppText>
        </View>
        <OutlineBadge label="Logged" color={theme.success} />
      </View>
      <View style={styles.footer}>
        <View style={[styles.categoryChip, { backgroundColor: theme.cardMuted }]}>
          <AppText variant="caption" color="textSecondary">
            {category}
          </AppText>
        </View>
        <View style={styles.timeRow}>
          <Feather name="clock" size={13} color={theme.textSecondary} />
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {visitor.expectedTime}
            {visitor.vehicle && visitor.vehicle !== '—' ? ` · ${visitor.vehicle}` : ''}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.onehalf },
  photoBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
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
