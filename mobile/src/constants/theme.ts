/**
 * SocietyOne design tokens — lime + ink design language.
 * Lime #D6F252 accent, near-black ink surfaces, warm off-white background,
 * large 28px radii, pill buttons, soft shadows, 8pt grid.
 */

import { Platform } from 'react-native';

export const Brand = {
  lime: '#D6F252',
  limeDeep: '#C2E13B',
  ink: '#131417',
  inkSoft: '#1B1D21',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export const Colors = {
  light: {
    primary: '#131417',
    primaryDark: '#000000',
    onPrimary: '#D6F252',
    secondary: '#1B1D21',
    accent: '#D6F252',
    accentSoft: '#EFF8CD',
    onAccent: '#131417',
    success: Brand.success,
    warning: Brand.warning,
    error: Brand.error,
    info: Brand.info,
    background: '#F1F0EA',
    /** Home lower canvas — pure black below the white header card. */
    canvasDark: '#000000',
    /** Cards/pills sitting on the black canvas (slightly elevated). */
    elevatedDark: '#1C1C1E',
    card: '#FFFFFF',
    cardMuted: '#EFEEE7',
    /** Dark tiles/cards used on light screens (quick actions, payment cards). */
    surfaceDark: '#131417',
    cardOnDark: '#1B1D21',
    textOnDark: '#FFFFFF',
    textSecondaryOnDark: '#9A9DA3',
    text: '#131417',
    textSecondary: '#75787E',
    border: '#E7E6DF',
    primarySoft: '#EBEAE3',
    successSoft: '#DDF5E4',
    warningSoft: '#FBF0D4',
    errorSoft: '#FCE3E1',
    infoSoft: '#E0EBFC',
    skeleton: '#E5E4DD',
    tabBar: 'rgba(19,20,23,0.94)',
  },
  dark: {
    primary: '#D6F252',
    primaryDark: '#C2E13B',
    onPrimary: '#131417',
    secondary: '#9DA0A6',
    accent: '#D6F252',
    accentSoft: '#2B2E1B',
    onAccent: '#131417',
    success: Brand.success,
    warning: Brand.warning,
    error: Brand.error,
    info: Brand.info,
    background: '#0D0E10',
    card: '#1A1B1E',
    cardMuted: '#242528',
    surfaceDark: '#1A1B1E',
    cardOnDark: '#2A2B2F',
    textOnDark: '#FFFFFF',
    textSecondaryOnDark: '#9A9DA3',
    text: '#F5F5F4',
    textSecondary: '#9A9DA3',
    border: '#292A2E',
    primarySoft: '#2B2E1B',
    successSoft: '#15351F',
    warningSoft: '#392D10',
    errorSoft: '#3B1B19',
    infoSoft: '#152949',
    skeleton: '#26272B',
    tabBar: 'rgba(42,43,46,0.96)',
  },
} as const;

export type ThemePalette = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof ThemePalette;

export const Fonts = {
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

/** 8pt grid */
export const Spacing = {
  half: 4,
  one: 8,
  onehalf: 12,
  two: 16,
  three: 24,
  four: 32,
  five: 40,
  six: 64,
} as const;

export const Radius = {
  sm: 12,
  md: 18,
  lg: 28,
  full: 999,
} as const;

/** Very soft shadow — 8px blur, no hard edges */
export const softShadow = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(19, 20, 23, 0.05)' } as object,
  default: {
    shadowColor: '#131417',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});

export const MaxContentWidth = 640;

/** Height reserved for the floating pill tab bar. */
export const FloatingTabBarInset = 96;
