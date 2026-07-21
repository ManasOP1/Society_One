import { View, type ViewProps } from 'react-native';

import { Radius, softShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CardProps = ViewProps & {
  muted?: boolean;
  padded?: boolean;
  /** Ink-dark card (used on light screens, e.g. profile rows / quick actions). */
  dark?: boolean;
};

export function Card({ style, muted, dark, padded = true, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: dark ? theme.surfaceDark : muted ? theme.cardMuted : theme.card,
          borderRadius: Radius.lg,
        },
        !muted && !dark && softShadow,
        padded && { padding: Spacing.two + Spacing.half },
        style,
      ]}
      {...rest}
    />
  );
}
