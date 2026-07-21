/**
 * Animated success burst — green check circle with lime/success particles.
 * Uses SocietyOne theme tokens (lime accent + success green).
 */

import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PARTICLE_COUNT = 10;
const BURST_DISTANCE = 72;

type ParticleKind = 'dot' | 'star';

const PARTICLES: { angle: number; size: number; kind: ParticleKind; colorKey: 'accent' | 'success' }[] =
  Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (i % 2 ? 0.2 : -0.15),
    size: i % 3 === 0 ? 14 : i % 3 === 1 ? 10 : 8,
    kind: i % 4 === 0 ? 'star' : 'dot',
    colorKey: i % 2 === 0 ? 'accent' : 'success',
  }));

export function PaymentSuccessAnimation() {
  const theme = useTheme();
  const burst = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const haloScale = useSharedValue(0.6);
  const haloOpacity = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 11, stiffness: 180 });
    haloScale.value = withTiming(1.15, { duration: 520, easing: Easing.out(Easing.cubic) });
    haloOpacity.value = withTiming(0.35, { duration: 400 });
    burst.value = withDelay(80, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [burst, checkScale, haloOpacity, haloScale]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  return (
    <View style={styles.wrap} accessibilityLabel="Payment successful">
      {PARTICLES.map((p, idx) => (
        <BurstParticle key={idx} particle={p} burst={burst} accent={theme.accent} success={theme.success} />
      ))}

      <Animated.View
        style={[
          styles.halo,
          { backgroundColor: theme.surfaceDark },
          haloStyle,
        ]}
      />

      <Animated.View
        style={[
          styles.checkCircle,
          { backgroundColor: theme.success, borderColor: Brand.limeDeep },
          checkStyle,
        ]}>
        <Feather name="check" size={42} color="#FFFFFF" strokeWidth={3} />
      </Animated.View>
    </View>
  );
}

function BurstParticle({
  particle,
  burst,
  accent,
  success,
}: {
  particle: (typeof PARTICLES)[number];
  burst: SharedValue<number>;
  accent: string;
  success: string;
}) {
  const color = particle.colorKey === 'accent' ? accent : success;

  const style = useAnimatedStyle(() => {
    const progress = burst.value;
    const dist = interpolate(progress, [0, 1], [0, BURST_DISTANCE]);
    const x = Math.cos(particle.angle) * dist;
    const y = Math.sin(particle.angle) * dist;
    const scale = interpolate(progress, [0, 0.35, 1], [0.2, 1.1, 0.85]);
    const opacity = interpolate(progress, [0, 0.15, 0.7, 1], [0, 1, 1, 0]);

    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { scale }],
    };
  });

  if (particle.kind === 'star') {
    return (
      <Animated.View style={[styles.particle, style]}>
        <Feather name="star" size={particle.size} color={color} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.particle,
        styles.dot,
        {
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  halo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: Radius.full,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    zIndex: 2,
  },
  particle: {
    position: 'absolute',
    zIndex: 1,
  },
  dot: {
    shadowColor: Brand.lime,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
});
