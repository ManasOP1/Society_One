import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Skeleton({
  width = '100%',
  height = 16,
  radius = Radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.skeleton }, animatedStyle, style]}
    />
  );
}

/** Standard card-shaped list skeleton. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.onehalf }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, { backgroundColor: theme.card }]}>
          <Skeleton width={44} height={44} radius={Radius.full} />
          <View style={{ flex: 1, gap: Spacing.one }}>
            <Skeleton width="62%" height={14} />
            <Skeleton width="38%" height={12} />
          </View>
          <Skeleton width={64} height={22} radius={Radius.full} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.onehalf,
    padding: Spacing.two,
    borderRadius: Radius.lg,
  },
});
