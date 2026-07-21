import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { SearchField } from '@/components/ui/search-field';
import { Brand, Fonts, Radius, Spacing, softShadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MONTH_OPTIONS = [
  { value: 'All', label: 'All months' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

export type MonthFilter = (typeof MONTH_OPTIONS)[number]['value'];

export const STATUS_OPTIONS = ['All', 'Pending', 'Overdue', 'Partial', 'Paid'] as const;
export type StatusFilter = (typeof STATUS_OPTIONS)[number];

const STATUS_META: Record<
  StatusFilter,
  { label: string; icon: keyof typeof Feather.glyphMap }
> = {
  All: { label: 'All', icon: 'layers' },
  Pending: { label: 'Pending', icon: 'clock' },
  Overdue: { label: 'Overdue', icon: 'alert-circle' },
  Partial: { label: 'Partial', icon: 'pie-chart' },
  Paid: { label: 'Paid', icon: 'check-circle' },
};

type CompactSelectProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

function CompactSelect({ label, value, options, onChange, disabled }: CompactSelectProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <View style={styles.compactField}>
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.compactTrigger,
            {
              backgroundColor: theme.cardMuted,
              borderColor: theme.border,
              opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
            },
          ]}>
          <AppText variant="bodySemi" numberOfLines={1} style={{ flex: 1 }}>
            {selected?.label ?? value}
          </AppText>
          <Feather name="chevron-down" size={16} color={theme.textSecondary} />
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
                      styles.sheetOption,
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

function StatusChip({
  option,
  active,
  onPress,
}: {
  option: StatusFilter;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const meta = STATUS_META[option];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.statusChip,
        {
          backgroundColor: active ? theme.primary : theme.cardMuted,
          borderColor: active ? theme.primary : theme.border,
        },
      ]}>
      <Feather
        name={meta.icon}
        size={14}
        color={active ? theme.onPrimary : theme.textSecondary}
      />
      <AppText variant="label" style={{ color: active ? theme.onPrimary : theme.text }}>
        {meta.label}
      </AppText>
    </Pressable>
  );
}

export function periodLabel(year: string, month: MonthFilter): string {
  if (year === 'All' && month === 'All') return 'All time';
  const monthName = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? 'All months';
  if (year === 'All') return monthName;
  if (month === 'All') return year;
  const shortMonth = monthName.slice(0, 3);
  return `${shortMonth} ${year}`;
}

export function PaymentsFilterCard({
  search,
  onSearchChange,
  searchPlaceholder,
  showStatus = false,
  status,
  onStatusChange,
  year,
  month,
  years,
  onYearChange,
  onMonthChange,
  resultCount,
  activeFilters,
  onClearFilters,
  style,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  showStatus?: boolean;
  status?: StatusFilter;
  onStatusChange?: (value: StatusFilter) => void;
  year: string;
  month: MonthFilter;
  years: string[];
  onYearChange: (value: string) => void;
  onMonthChange: (value: MonthFilter) => void;
  resultCount: number;
  activeFilters: number;
  onClearFilters: () => void;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const yearOptions = [{ value: 'All', label: 'All years' }, ...years.map((y) => ({ value: y, label: y }))];

  return (
    <View style={[styles.card, softShadow, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Feather name="sliders" size={16} color={theme.text} />
          <AppText variant="label">Find & filter</AppText>
        </View>
        {activeFilters > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
            onPress={onClearFilters}
            hitSlop={8}
            style={[styles.clearBtn, { backgroundColor: theme.errorSoft }]}>
            <Feather name="rotate-ccw" size={13} color={theme.error} />
            <AppText variant="caption" style={{ color: theme.error }}>
              Reset
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <SearchField value={search} onChangeText={onSearchChange} placeholder={searchPlaceholder} muted />

      {showStatus && status && onStatusChange ? (
        <View style={styles.section}>
          <AppText variant="caption" color="textSecondary">
            Status
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusRow}>
            {STATUS_OPTIONS.map((option) => (
              <StatusChip
                key={option}
                option={option}
                active={status === option}
                onPress={() => onStatusChange(option)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="caption" color="textSecondary">
          Period
        </AppText>
        <View style={styles.periodRow}>
          <CompactSelect
            label="Year"
            value={year}
            options={yearOptions}
            onChange={onYearChange}
          />
          <CompactSelect
            label="Month"
            value={month}
            options={MONTH_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
            onChange={(v) => onMonthChange(v as MonthFilter)}
          />
        </View>
      </View>

      <View style={[styles.summaryBar, { backgroundColor: theme.cardMuted }]}>
        <AppText variant="caption" color="textSecondary">
          Showing {resultCount} {resultCount === 1 ? 'record' : 'records'}
          {activeFilters > 0 ? ` · ${periodLabel(year, month)}` : ''}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.onehalf,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  section: { gap: Spacing.one },
  statusRow: { gap: Spacing.one, paddingVertical: 2 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: Spacing.onehalf,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  periodRow: {
    flexDirection: 'row',
    gap: Spacing.onehalf,
  },
  compactField: {
    flex: 1,
    gap: 4,
  },
  compactTrigger: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.onehalf,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  summaryBar: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.onehalf,
    paddingVertical: Spacing.one,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(19, 20, 23, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '55%',
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
  sheetOption: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
