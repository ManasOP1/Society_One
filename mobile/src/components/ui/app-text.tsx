import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AppTextProps = TextProps & {
  variant?: 'display' | 'title' | 'heading' | 'body' | 'bodySemi' | 'label' | 'caption' | 'mono';
  color?: ThemeColor;
};

export function AppText({ style, variant = 'body', color, ...rest }: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      style={[styles[variant], { color: theme[color ?? (variant === 'caption' || variant === 'label' ? 'textSecondary' : 'text')] }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: Fonts.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading: { fontFamily: Fonts.semiBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 20 },
  bodySemi: { fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: Fonts.semiBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 18 },
});
