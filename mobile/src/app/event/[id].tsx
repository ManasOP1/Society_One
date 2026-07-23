import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { apiErrorMessage } from '@/api/client';
import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useEvent } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { formatDate } from '@/utils/format';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id ?? '');
  const { markRead } = useUnreadNotifications();
  const retryEvent = () => {
    void event.refetch();
  };

  useEffect(() => {
    if (id) void markRead(id);
  }, [id, markRead]);

  if (event.isPending) {
    return (
      <Screen>
        <Skeleton height={28} width="70%" />
        <Skeleton height={90} radius={Radius.lg} />
        <Skeleton height={180} radius={Radius.lg} />
      </Screen>
    );
  }

  if (event.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState message={apiErrorMessage(event.error)} onRetry={retryEvent} />
      </Screen>
    );
  }

  const e = event.data;
  if (!e) {
    return (
      <Screen scroll={false}>
        <ErrorState message="Event not found" onRetry={retryEvent} />
      </Screen>
    );
  }

  const done = e.status === 'Completed';

  return (
    <Screen>
      <View style={{ gap: Spacing.one }}>
        <Badge label={e.status} tone={done ? 'neutral' : e.status === 'Ongoing' ? 'success' : 'primary'} />
        <AppText variant="title">{e.title}</AppText>
      </View>

      <Card style={{ gap: Spacing.onehalf }}>
        <InfoRow icon="calendar" label="Date" value={e.endDate && e.endDate !== e.date ? `${formatDate(e.date)} — ${formatDate(e.endDate)}` : formatDate(e.date)} />
        <InfoRow icon="map-pin" label="Location" value={e.location} />
        <InfoRow icon="users" label="RSVPs" value={`${e.rsvpCount} residents attending`} />
      </Card>

      <Card>
        <AppText variant="label" color="primary" style={{ marginBottom: Spacing.one }}>
          ABOUT THIS EVENT
        </AppText>
        <AppText variant="body" style={{ lineHeight: 24 }}>
          {e.description}
        </AppText>
      </Card>
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: theme.primarySoft }]}>
        <Feather name={icon} size={16} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
        <AppText variant="bodySemi">{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.onehalf },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
