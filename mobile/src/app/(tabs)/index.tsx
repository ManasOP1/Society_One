import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiErrorMessage } from '@/api/client';
import { SocietyLogo } from '@/components/society-logo';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { SearchField } from '@/components/ui/search-field';
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import {
  Brand,
  FloatingTabBarInset,
  Fonts,
  MaxContentWidth,
  Radius,
  Spacing,
  softShadow,
} from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useDashboard, useSocietySettings } from '@/hooks/queries';
import { isInitialLoad } from '@/hooks/query-ui';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { formatDate, formatINR, parseLocalDate } from '@/utils/format';

function eventDateChip(iso: string): { day: string; month: string } {
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return { day: '—', month: '—' };
  return { day: String(d.getDate()), month: d.toLocaleString('en', { month: 'short' }) };
}

export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const dashboard = useDashboard();
  const settings = useSocietySettings();
  const { unreadCount } = useUnreadNotifications();
  const [search, setSearch] = useState('');
  const isAdmin = user?.role === 'admin';

  const summary = dashboard.data;
  const firstName = (user?.name ?? 'Resident').split(' ')[0];

  return (
    <View style={[styles.root, { backgroundColor: theme.canvasDark }]}>
      <ScrollView
        style={{ backgroundColor: theme.canvasDark }}
        contentContainerStyle={{ paddingBottom: insets.bottom + FloatingTabBarInset + Spacing.three }}
        showsVerticalScrollIndicator={false}>
        {/* White header card */}
        <View style={[styles.header, softShadow, { backgroundColor: theme.card, paddingTop: insets.top + Spacing.two }]}>
          <View style={styles.headerInner}>
            <View style={styles.greetingRow}>
              <Avatar name={user?.name ?? '?'} size={48} />
              <View style={{ flex: 1 }}>
                <AppText variant="heading">
                  {isAdmin ? `Welcome, ${firstName}` : `Hello, ${firstName}`}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {isAdmin
                    ? `${settings.data?.societyName ?? 'Society'} · Admin`
                    : settings.data?.societyName ?? 'Your society'}
                </AppText>
              </View>
              <CircleIconButton icon="message-circle" label="Community" onPress={() => router.push('/community')} />
              <CircleIconButton
                icon="bell"
                label="Notifications"
                badgeCount={unreadCount}
                onPress={() => router.push('/community')}
              />
            </View>

            {/* Search — submits into Payments with the query applied */}
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              muted
              onSubmit={() => {
                const q = search.trim();
                if (q) router.push({ pathname: '/bills', params: { q } });
              }}
            />

            {/* Lime stat chips */}
            {isInitialLoad(dashboard) ? (
              <View style={styles.chipRow}>
                <Skeleton height={64} radius={Radius.full} style={{ flex: 1 }} width="48%" />
                <Skeleton height={64} radius={Radius.full} style={{ flex: 1 }} width="48%" />
              </View>
            ) : summary ? (
              <View style={styles.chipRow}>
                <StatChip
                  value={formatINR(summary.outstandingTotal)}
                  label={isAdmin ? 'Collections' : 'Dues'}
                  onPress={() =>
                    summary.outstandingTotal > 0 && summary.nextDueInvoiceNo
                      ? router.push({ pathname: '/pay/[invoiceNo]', params: { invoiceNo: summary.nextDueInvoiceNo } })
                      : router.push('/bills')
                  }
                />
                <StatChip
                  value={String(summary.pendingInvoices).padStart(2, '0')}
                  label={isAdmin ? 'Open Invoices' : 'Pending Bills'}
                  onPress={() => router.push('/bills')}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* ---- Dark canvas content ---- */}
        <View style={[styles.body, { backgroundColor: theme.canvasDark }]}>
          {dashboard.isError ? (
            <Card>
              <ErrorState message={apiErrorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />
            </Card>
          ) : isInitialLoad(dashboard) ? (
            <ListSkeleton rows={3} />
          ) : summary ? (
            <>
              {/* Quick pill shortcuts */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.one }}>
                <PillChip icon="file-text" label="Invoices" onPress={() => router.push('/bills')} />
                <PillChip
                  icon="credit-card"
                  label="Receipts"
                  onPress={() => router.push({ pathname: '/bills', params: { tab: 'Receipts' } })}
                />
                <PillChip icon="users" label="Visitors" onPress={() => router.push('/visitors')} />
                <PillChip icon="calendar" label="Events" onPress={() => router.push('/community')} />
              </ScrollView>

              {/* Announcements */}
              <SectionHeader title="Announcements" onViewAll={() => router.push('/community')} />
              {summary.latestNotice ? (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/notice/[id]', params: { id: summary.latestNotice!.id } })
                  }>
                  <View style={[styles.announceCard, { backgroundColor: theme.elevatedDark }]}>
                    <View style={styles.announceTop}>
                      <AppText variant="heading" style={{ flex: 1, color: theme.textOnDark }} numberOfLines={1}>
                        {summary.latestNotice.title}
                      </AppText>
                      <View style={[styles.dateChip, { borderColor: 'rgba(255,255,255,0.2)' }]}>
                        <AppText variant="caption" style={{ color: theme.textSecondaryOnDark }}>
                          {formatDate(summary.latestNotice.publishedAt)}
                        </AppText>
                      </View>
                    </View>
                    <AppText variant="body" style={{ color: theme.textSecondaryOnDark }} numberOfLines={3}>
                      {summary.latestNotice.body}
                    </AppText>
                    <View style={[styles.readMore, { backgroundColor: theme.card }]}>
                      <AppText variant="label" style={{ color: theme.text }}>
                        Read More
                      </AppText>
                      <Feather name="arrow-right" size={15} color={theme.text} />
                    </View>
                  </View>
                </Pressable>
              ) : (
                <View style={[styles.announceCard, { backgroundColor: theme.elevatedDark }]}>
                  <AppText variant="body" style={{ color: theme.textSecondaryOnDark }}>
                    No announcements yet.
                  </AppText>
                </View>
              )}

              {/* Quick actions */}
              <SectionHeader title="Quick Actions" onViewAll={() => router.push('/bills')} />
              <View style={styles.actionsGrid}>
                <ActionTile
                  icon="zap"
                  label={isAdmin ? 'Collect Dues' : 'Pay Dues'}
                  onPress={() =>
                    summary.nextDueInvoiceNo
                      ? router.push({ pathname: '/pay/[invoiceNo]', params: { invoiceNo: summary.nextDueInvoiceNo } })
                      : router.push('/bills')
                  }
                />
                <ActionTile
                  icon="credit-card"
                  label="Receipts"
                  onPress={() => router.push({ pathname: '/bills', params: { tab: 'Receipts' } })}
                />
                <ActionTile icon="bell" label="Notices" onPress={() => router.push('/community')} />
                <ActionTile icon="users" label="Visitors" onPress={() => router.push('/visitors')} />
              </View>

              {/* Upcoming event */}
              {summary.upcomingEvent ? (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/event/[id]', params: { id: summary.upcomingEvent!.id } })
                  }>
                  <View style={[styles.darkRow, { backgroundColor: theme.elevatedDark }]}>
                    <View style={[styles.darkDate, { backgroundColor: theme.cardOnDark }]}>
                      <AppText variant="title" style={{ color: Brand.lime }}>
                        {eventDateChip(summary.upcomingEvent.date).day}
                      </AppText>
                      <AppText variant="caption" style={{ color: Brand.lime }}>
                        {eventDateChip(summary.upcomingEvent.date).month}
                      </AppText>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="caption" style={{ color: theme.textSecondaryOnDark }}>
                        UPCOMING EVENT
                      </AppText>
                      <AppText variant="heading" style={{ color: theme.textOnDark }} numberOfLines={1}>
                        {summary.upcomingEvent.title}
                      </AppText>
                      <AppText variant="caption" style={{ color: theme.textSecondaryOnDark }} numberOfLines={1}>
                        {summary.upcomingEvent.location}
                      </AppText>
                    </View>
                    <Feather name="chevron-right" size={20} color={theme.textSecondaryOnDark} />
                  </View>
                </Pressable>
              ) : null}

              {/* Last payment */}
              {summary.lastReceipt ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/receipt/[receiptNo]',
                      params: { receiptNo: summary.lastReceipt!.receiptNo },
                    })
                  }>
                  <View style={[styles.darkRow, { backgroundColor: theme.elevatedDark }]}>
                    <View style={[styles.darkDate, { backgroundColor: theme.cardOnDark }]}>
                      <Feather name="check" size={22} color={Brand.lime} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="caption" style={{ color: theme.textSecondaryOnDark }}>
                        LAST PAYMENT
                      </AppText>
                      <AppText variant="heading" style={{ color: theme.textOnDark }}>
                        {formatINR(summary.lastReceipt.totalPaid)}
                      </AppText>
                      <AppText variant="caption" style={{ color: theme.textSecondaryOnDark }}>
                        {summary.lastReceipt.receiptNo} · {formatDate(summary.lastReceipt.paymentDate)}
                      </AppText>
                    </View>
                    <Feather name="chevron-right" size={20} color={theme.textSecondaryOnDark} />
                  </View>
                </Pressable>
              ) : null}

              {settings.data ? (
                <View style={styles.footerBrand}>
                  <SocietyLogo settings={settings.data} size={28} />
                  <AppText variant="caption" color="textSecondaryOnDark">
                    {settings.data.societyName}
                  </AppText>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------ pieces ------------------------------ */

function CircleIconButton({
  icon,
  label,
  badgeCount = 0,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  badgeCount?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const showBadge = badgeCount > 0;
  const badgeLabel = badgeCount > 9 ? '9+' : String(badgeCount);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showBadge ? `${label}, ${badgeCount} unread` : label}
      onPress={onPress}
      style={[styles.circleBtn, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
      <Feather name={icon} size={19} color={theme.text} />
      {showBadge ? (
        <View style={[styles.badge, { backgroundColor: theme.error }]}>
          <AppText style={styles.badgeText}>{badgeLabel}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

function StatChip({ value, label, onPress }: { value: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.statChip, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1 }}>
        <AppText style={styles.statValue} numberOfLines={1}>
          {value}
        </AppText>
        <AppText variant="caption" style={{ color: '#3D4413' }} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <View style={styles.statArrow}>
        <Feather name="chevron-right" size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

function PillChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillChip,
        { backgroundColor: theme.elevatedDark },
        pressed && { opacity: 0.8 },
      ]}>
      <Feather name={icon} size={15} color={theme.textOnDark} />
      <AppText variant="label" style={{ color: theme.textOnDark }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading" style={{ color: theme.textOnDark }}>
        {title}
      </AppText>
      {onViewAll ? (
        <Pressable accessibilityRole="button" onPress={onViewAll}>
          <AppText variant="label" style={{ color: theme.textSecondaryOnDark }}>
            View all
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        { backgroundColor: theme.elevatedDark },
        pressed && { opacity: 0.8 },
      ]}>
      <View style={[styles.actionIcon, { backgroundColor: theme.cardOnDark }]}>
        <Feather name={icon} size={18} color={Brand.lime} />
      </View>
      <AppText variant="label" style={{ color: theme.textOnDark }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/* ------------------------------ styles ------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    borderBottomLeftRadius: Radius.lg + 4,
    borderBottomRightRadius: Radius.lg + 4,
    paddingBottom: Spacing.three,
  },
  headerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.onehalf },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Fonts.bold,
    lineHeight: 12,
  },
  chipRow: { flexDirection: 'row', gap: Spacing.onehalf },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: Brand.lime,
    borderRadius: Radius.full,
    paddingVertical: Spacing.onehalf,
    paddingLeft: Spacing.two + Spacing.half,
    paddingRight: Spacing.one,
  },
  statValue: { fontFamily: Fonts.extraBold, fontSize: 19, lineHeight: 24, color: Brand.ink },
  statArrow: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  pillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    minHeight: 44,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  announceCard: {
    borderRadius: Radius.lg,
    padding: Spacing.two + Spacing.half,
    gap: Spacing.one,
  },
  announceTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dateChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.onehalf,
    paddingVertical: 5,
  },
  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    minHeight: 46,
    marginTop: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.onehalf },
  actionTile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.md + 2,
    padding: Spacing.two,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.onehalf,
    borderRadius: Radius.lg,
    padding: Spacing.two,
  },
  darkDate: {
    width: 54,
    height: 54,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
});
