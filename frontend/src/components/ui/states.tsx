import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EmptyState({
  icon = 'inbox',
  title,
  message,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
        <Feather name={icon} size={26} color={theme.primary} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: theme.errorSoft }]}>
        <Feather name="alert-triangle" size={26} color={theme.error} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        Unable to load
      </AppText>
      <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      {onRetry ? <Button title="Retry" variant="secondary" size="md" onPress={onRetry} style={{ marginTop: Spacing.one }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
});
