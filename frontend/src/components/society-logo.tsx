import { Image } from 'expo-image';
import { View } from 'react-native';

import type { SocietySettings } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { initialsOf } from '@/utils/format';

/** Society's uploaded logo, or a branded monogram fallback. */
export function SocietyLogo({ settings, size = 48 }: { settings: Pick<SocietySettings, 'logoDataUrl' | 'logoText' | 'societyName'>; size?: number }) {
  const theme = useTheme();

  if (settings.logoDataUrl) {
    return (
      <Image
        source={{ uri: settings.logoDataUrl }}
        style={{ width: size, height: size, borderRadius: Radius.sm }}
        contentFit="contain"
      />
    );
  }

  const monogram = settings.logoText?.trim() || initialsOf(settings.societyName);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radius.sm,
        backgroundColor: theme.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <AppText variant="label" style={{ color: theme.onPrimary, fontSize: size * 0.34, lineHeight: size * 0.44 }}>
        {monogram.slice(0, 2).toUpperCase()}
      </AppText>
    </View>
  );
}
