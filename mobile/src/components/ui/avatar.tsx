import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { initialsOf } from '@/utils/format';

export function Avatar({
  name,
  size = 44,
  ring,
}: {
  name: string;
  size?: number;
  /** Lime ring around the avatar (profile hero). */
  ring?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radius.full,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
        ...(ring ? { borderWidth: 3, borderColor: theme.accent, backgroundColor: theme.cardOnDark } : {}),
      }}>
      <AppText
        variant="label"
        style={{
          color: ring ? theme.accent : theme.onAccent,
          fontSize: size * 0.34,
          lineHeight: size * 0.46,
        }}>
        {initialsOf(name)}
      </AppText>
    </View>
  );
}
