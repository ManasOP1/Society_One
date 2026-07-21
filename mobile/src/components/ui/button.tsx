import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  size?: 'md' | 'lg';
  icon?: React.ReactNode;
  style?: ViewStyle;
  /** Override the label/spinner color (e.g. brand color on a white button). */
  textColor?: string;
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  size = 'lg',
  icon,
  style,
  textColor: textColorProp,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const containerByVariant: Record<ButtonVariant, ViewStyle> = {
    // Ink pill with lime label — the signature CTA of this design language.
    primary: { backgroundColor: theme.primary },
    // Lime pill with ink label.
    secondary: { backgroundColor: theme.accent },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.border },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: theme.error },
  };

  const textColor =
    textColorProp ??
    (variant === 'primary'
      ? theme.onPrimary
      : variant === 'danger'
        ? '#FFFFFF'
        : variant === 'secondary'
          ? theme.onAccent
          : theme.text);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        containerByVariant[variant],
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <AppText style={[styles.label, { color: textColor }]}>{title}</AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
  },
  lg: { minHeight: 54, paddingHorizontal: Spacing.three },
  md: { minHeight: 44, paddingHorizontal: Spacing.two },
  label: { fontFamily: Fonts.semiBold, fontSize: 15, lineHeight: 20 },
});
