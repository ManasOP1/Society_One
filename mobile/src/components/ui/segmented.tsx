import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Segments inside a white pill track — active segment is an ink pill
 * (matches the "Visitors | Parcel | Helpers" bar in the reference design).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.card }]}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => onChange(option)}
            style={[styles.segment, active && { backgroundColor: theme.primary }]}>
            <AppText variant="label" style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
              {option}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontally scrollable filter pills (for many options, e.g. months). */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labelFor?: (value: T) => string;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: Spacing.one, paddingVertical: 2 }}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => onChange(option)}
            style={[
              styles.chip,
              { backgroundColor: active ? theme.primary : theme.card },
            ]}>
            <AppText variant="label" style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
              {labelFor ? labelFor(option) : option}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: Spacing.half,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
