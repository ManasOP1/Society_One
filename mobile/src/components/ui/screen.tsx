import {
  FlatList,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingTabBarInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Standard screen shell: themed background, horizontal padding, max content
 * width on large screens. Live data refreshes silently in the background.
 */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  bottomInset = true,
  topInset = false,
  tabbed = false,
  backgroundColor,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  bottomInset?: boolean;
  /** Add the status-bar inset — use on tab screens that render without a header. */
  topInset?: boolean;
  /** Reserve space for the floating pill tab bar. */
  tabbed?: boolean;
  backgroundColor?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padBottom =
    (bottomInset ? insets.bottom : 0) + (tabbed ? FloatingTabBarInset : 0) + Spacing.four;
  const padTop = (topInset ? insets.top : 0) + Spacing.two;
  const bg = backgroundColor ?? theme.background;

  if (!scroll) {
    return (
      <View style={[styles.root, { backgroundColor: bg }]}>
        <View style={[styles.content, { paddingBottom: padBottom, paddingTop: padTop }, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: bg }]}
      contentContainerStyle={[styles.content, { paddingBottom: padBottom, paddingTop: padTop }, contentStyle]}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

/**
 * Virtualized variant of Screen for long lists (invoices, receipts, visitors).
 */
export function ListScreen<T>({
  data,
  renderItem,
  keyExtractor,
  header,
  empty,
  tabbed = true,
  topInset = true,
}: {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T) => string;
  header?: React.ReactElement;
  empty?: React.ReactElement;
  tabbed?: boolean;
  topInset?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padBottom = insets.bottom + (tabbed ? FloatingTabBarInset : 0) + Spacing.four;
  const padTop = (topInset ? insets.top : 0) + Spacing.two;

  return (
    <FlatList
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: padBottom, paddingTop: padTop }]}
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
