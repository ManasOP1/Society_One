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
import { useNotice } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { formatDate } from '@/utils/format';

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const notice = useNotice(id ?? '');
  const { markRead } = useUnreadNotifications();
  const retryNotice = () => {
    void notice.refetch();
  };

  useEffect(() => {
    if (id) void markRead(id);
  }, [id, markRead]);

  if (notice.isPending) {
    return (
      <Screen>
        <Skeleton height={28} width="70%" />
        <Skeleton height={16} width="40%" />
        <Skeleton height={220} radius={Radius.lg} />
      </Screen>
    );
  }

  if (notice.isError) {
    return (
      <Screen scroll={false}>
        <ErrorState message={apiErrorMessage(notice.error)} onRetry={retryNotice} />
      </Screen>
    );
  }

  const n = notice.data;
  if (!n) {
    return (
      <Screen scroll={false}>
        <ErrorState message="Notice not found" onRetry={retryNotice} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: Spacing.one }}>
        {n.pinned ? <Badge label="Pinned" tone="warning" /> : null}
        <AppText variant="title">{n.title}</AppText>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={13} color={theme.textSecondary} />
          <AppText variant="caption" color="textSecondary">
            Published {formatDate(n.publishedAt)}
          </AppText>
        </View>
      </View>
      <Card>
        <AppText variant="body" style={{ lineHeight: 24 }}>
          {n.body}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
