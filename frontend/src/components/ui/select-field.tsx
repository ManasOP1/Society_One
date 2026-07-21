import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Brand, Fonts, Radius, Spacing, softShadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label: string;
  placeholder: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled,
  loading,
  style,
}: SelectFieldProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <View style={[{ gap: Spacing.half }, style]}>
        <AppText variant="label">{label}</AppText>
        <Pressable
          accessibilityRole="button"
          disabled={disabled || loading}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.field,
            softShadow,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
            },
          ]}>
          <AppText variant="body" color={selected ? 'text' : 'textSecondary'} style={{ flex: 1 }} numberOfLines={1}>
            {loading ? 'Loading…' : selected?.label ?? placeholder}
          </AppText>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.two },
            ]}
            onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <AppText variant="heading" style={{ marginBottom: Spacing.two }}>
              {label}
            </AppText>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: active ? Brand.lime : pressed ? theme.cardMuted : 'transparent',
                      },
                    ]}>
                    <AppText
                      variant="body"
                      style={{ color: active ? Brand.ink : theme.text, fontFamily: Fonts.medium }}>
                      {item.label}
                    </AppText>
                    {active ? <Feather name="check" size={18} color={Brand.ink} /> : null}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 54,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(19, 20, 23, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  option: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
