import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import type { InvoiceStatus } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { Radius, type ThemePalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const palette: Record<BadgeTone, { bg: string; fg: string }> = {
    success: { bg: theme.successSoft, fg: theme.success },
    warning: { bg: theme.warningSoft, fg: theme.warning },
    error: { bg: theme.errorSoft, fg: theme.error },
    info: { bg: theme.infoSoft, fg: theme.info },
    primary: { bg: theme.primarySoft, fg: theme.primary },
    neutral: { bg: theme.cardMuted, fg: theme.textSecondary },
  };
  const { bg, fg } = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <AppText variant="caption" style={{ color: fg, fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}

export function statusTone(status: InvoiceStatus): BadgeTone {
  switch (status) {
    case 'Paid':
      return 'success';
    case 'Partial':
      return 'warning';
    case 'Overdue':
      return 'error';
    case 'Cancelled':
      return 'neutral';
    default:
      return 'info';
  }
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge label={status} tone={statusTone(status)} />;
}

/** Bordered pill with a small icon — the "Approved ✓" style chip from the reference design. */
export function OutlineBadge({
  label,
  icon = 'check-circle',
  color,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  color?: string;
}) {
  const theme = useTheme();
  const fg = color ?? theme.textSecondary;
  return (
    <View style={[styles.outline, { borderColor: theme.border }]}>
      <Feather name={icon} size={12} color={fg} />
      <AppText variant="caption" style={{ color: fg, fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  outline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
});

export type { ThemePalette };
