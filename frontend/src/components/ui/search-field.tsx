import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Shared pill search input — used on Home, Payments and Community. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  muted,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  /** Muted background for use on white cards (e.g. the Home header). */
  muted?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: muted ? theme.cardMuted : theme.card }]}>
      <Feather name="search" size={17} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        accessibilityLabel={placeholder}
        style={[styles.input, { color: theme.text }]}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={10}>
          <Feather name="x" size={17} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 48,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
});
