import { Colors, type ThemePalette } from '@/constants/theme';

/**
 * SocietyOne uses a fixed light brand palette (warm off-white + white cards +
 * lime accents) regardless of the device dark-mode setting — matching the
 * product design reference.
 */
export function useTheme(): ThemePalette {
  return Colors.light;
}
