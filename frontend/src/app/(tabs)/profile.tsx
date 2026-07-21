import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiErrorMessage, IS_MOCK_API } from '@/api/client';
import { SocietyLogo } from '@/components/society-logo';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { Brand, FloatingTabBarInset, MaxContentWidth, Radius, Spacing, softShadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useSocietySettings } from '@/hooks/queries';
import { isInitialLoad } from '@/hooks/query-ui';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const settings = useSocietySettings();
  const isAdmin = user?.role === 'admin';

  function confirmLogout() {
    if (Platform.OS === 'web') {
      logout();
      return;
    }
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  }

  const flatLabel = user?.flat ? `Flat ${user.flat}` : null;
  const wingLabel = user?.wing ? `Wing ${user.wing}` : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.canvasDark }]}>
      <ScrollView
        style={{ backgroundColor: theme.canvasDark }}
        contentContainerStyle={{ paddingBottom: insets.bottom + FloatingTabBarInset + Spacing.three }}
        showsVerticalScrollIndicator={false}>
        {/* White header */}
        <View style={[styles.header, softShadow, { backgroundColor: theme.card, paddingTop: insets.top + Spacing.two }]}>
          <View style={styles.headerInner}>
            <AppText variant="title">Profile</AppText>
            <View style={styles.profileRow}>
              <Avatar name={user?.name ?? '?'} size={64} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="heading" numberOfLines={1}>
                  {user?.name ?? 'Resident'}
                </AppText>
                <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                  {settings.data?.societyName ?? 'Your society'}
                </AppText>
                {user?.phone ? (
                  <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                    {user.phone}
                  </AppText>
                ) : null}
              </View>
            </View>
            <View style={styles.chipRow}>
              {isAdmin ? (
                <Chip label="Admin" lime />
              ) : (
                <>
                  {wingLabel ? <Chip label={wingLabel} /> : null}
                  {flatLabel ? <Chip label={flatLabel} /> : null}
                  <Chip label="Resident" lime />
                </>
              )}
            </View>
          </View>
        </View>

        {/* Dark body */}
        <View style={styles.body}>
          {isInitialLoad(settings) ? (
            <>
              <Skeleton height={120} radius={Radius.lg} />
              <Skeleton height={180} radius={Radius.lg} />
            </>
          ) : settings.isError ? (
            <View style={[styles.card, { backgroundColor: theme.elevatedDark }]}>
              <ErrorState message={apiErrorMessage(settings.error)} onRetry={() => settings.refetch()} />
            </View>
          ) : settings.data ? (
            <>
              <SectionTitle title="Society" />
              <View style={[styles.card, { backgroundColor: theme.elevatedDark }]}>
                <View style={styles.societyTop}>
                  <SocietyLogo settings={settings.data} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodySemi" style={{ color: theme.textOnDark }} numberOfLines={1}>
                      {settings.data.societyName}
                    </AppText>
                    <AppText variant="caption" style={{ color: theme.textSecondaryOnDark }} numberOfLines={2}>
                      {settings.data.address}
                    </AppText>
                  </View>
                </View>
                <InfoRow icon="hash" label="Reg. no." value={settings.data.registrationNo} />
                <InfoRow icon="credit-card" label="PAN" value={settings.data.panNumber} last />
              </View>

              <SectionTitle title="Payment details" />
              <View style={[styles.card, { backgroundColor: theme.elevatedDark }]}>
                <InfoRow icon="home" label="Bank" value={settings.data.bankName} />
                <InfoRow icon="hash" label="Account" value={settings.data.bankAccount} />
                <InfoRow icon="code" label="IFSC" value={settings.data.bankIfsc} />
                <InfoRow icon="smartphone" label="UPI" value={settings.data.upiId} last />
              </View>
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={confirmLogout}
            style={({ pressed }) => [
              styles.signOut,
              { backgroundColor: theme.elevatedDark },
              pressed && { opacity: 0.85 },
            ]}>
            <Feather name="log-out" size={18} color={theme.error} />
            <AppText variant="bodySemi" style={{ color: theme.error, flex: 1 }}>
              Sign out
            </AppText>
            <Feather name="chevron-right" size={18} color={theme.textSecondaryOnDark} />
          </Pressable>

          <AppText variant="caption" style={{ color: theme.textSecondaryOnDark, textAlign: 'center' }}>
            SocietyOne v{Constants.expoConfig?.version ?? '1.0.0'}
            {IS_MOCK_API ? ' · Demo' : ''}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <AppText variant="label" style={{ color: theme.textOnDark }}>
      {title}
    </AppText>
  );
}

function Chip({ label, lime }: { label: string; lime?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: lime ? Brand.lime : theme.elevatedDark }]}>
      <AppText variant="caption" style={{ color: lime ? Brand.ink : theme.textOnDark }}>
        {label}
      </AppText>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.infoRow, !last && { borderBottomColor: 'rgba(255,255,255,0.08)', borderBottomWidth: 1 }]}>
      <View style={[styles.infoIcon, { backgroundColor: theme.cardOnDark }]}>
        <Feather name={icon} size={16} color={Brand.lime} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" style={{ color: theme.textSecondaryOnDark }}>
          {label}
        </AppText>
        <AppText variant="bodySemi" style={{ color: theme.textOnDark }} numberOfLines={1}>
          {value || '—'}
        </AppText>
      </View>
    </View>
  );
}

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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.onehalf,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.onehalf,
    paddingVertical: 6,
  },
  body: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  societyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.onehalf,
    padding: Spacing.two,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.onehalf,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.onehalf,
    minHeight: 58,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.onehalf,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.two,
    minHeight: 56,
    marginTop: Spacing.one,
  },
});
