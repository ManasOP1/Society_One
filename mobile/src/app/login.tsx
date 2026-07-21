import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IS_MOCK_API } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { Brand, Fonts, MaxContentWidth, Radius, Spacing, softShadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [societyId, setSocietyId] = useState<string | null>(null);
  const [wing, setWing] = useState<string | null>(null);
  const [flatNo, setFlatNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const societiesQuery = useQuery({
    queryKey: ['auth', 'societies'],
    queryFn: () => authApi.societies(),
    staleTime: 5 * 60_000,
  });

  const wingsQuery = useQuery({
    queryKey: ['auth', 'wings', societyId],
    queryFn: () => authApi.wings(societyId!),
    enabled: !!societyId,
    staleTime: 5 * 60_000,
  });

  const societyOptions = useMemo(
    () => (societiesQuery.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    [societiesQuery.data]
  );

  const wingOptions = useMemo(
    () =>
      (wingsQuery.data ?? []).map((w) => ({
        value: w.code,
        label: w.name ? `${w.code} · ${w.name}` : w.code,
      })),
    [wingsQuery.data]
  );

  useEffect(() => {
    setWing(null);
  }, [societyId]);

  const canSubmit =
    !!societyId &&
    !!wing &&
    flatNo.trim().length > 0 &&
    password.length >= 6 &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !societyId || !wing) return;
    setSubmitting(true);
    setError(null);
    const result = await login({
      societyId,
      wing,
      flatNo: flatNo.trim(),
      password,
    });
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  const inputStyle = [
    styles.input,
    softShadow,
    { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.logoBadge, softShadow]}>
            <Feather name="home" size={32} color={Brand.ink} />
          </View>
          <AppText variant="display" style={{ textAlign: 'center' }}>
            SocietyOne
          </AppText>
          <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            Sign in to manage your society dues, notices and more
          </AppText>
        </View>

        <View style={[styles.formCard, softShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <SelectField
            label="Society name"
            placeholder="Select your society"
            value={societyId}
            options={societyOptions}
            onChange={setSocietyId}
            loading={societiesQuery.isLoading}
            disabled={societiesQuery.isError}
          />

          <SelectField
            label="Wing name"
            placeholder={societyId ? 'Select your wing' : 'Choose a society first'}
            value={wing}
            options={wingOptions}
            onChange={setWing}
            loading={wingsQuery.isLoading}
            disabled={!societyId}
          />

          <View style={{ gap: Spacing.half }}>
            <AppText variant="label">Flat number</AppText>
            <TextInput
              style={inputStyle}
              value={flatNo}
              onChangeText={setFlatNo}
              placeholder="e.g. 203"
              placeholderTextColor={theme.textSecondary}
              keyboardType="default"
              autoCapitalize="none"
              returnKeyType="next"
            />
          </View>

          <View style={{ gap: Spacing.half }}>
            <AppText variant="label">Password</AppText>
            <View>
              <TextInput
                style={[...inputStyle, { paddingRight: 52 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          {societiesQuery.isError ? (
            <View style={[styles.errorBox, { backgroundColor: theme.errorSoft }]}>
              <Feather name="wifi-off" size={16} color={theme.error} />
              <AppText variant="caption" style={{ color: theme.error, flex: 1 }}>
                Could not load societies. Check your connection and API URL.
              </AppText>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.errorSoft }]}>
              <Feather name="alert-circle" size={16} color={theme.error} />
              <AppText variant="caption" style={{ color: theme.error, flex: 1 }}>
                {error}
              </AppText>
            </View>
          ) : null}

          <Button
            title="Sign In"
            variant="secondary"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            style={{ marginTop: Spacing.one }}
          />

          <Link href="/forgot-password" asChild>
            <Pressable style={{ alignSelf: 'center', paddingVertical: Spacing.one }}>
              <AppText variant="label" color="textSecondary">
                Forgot password?
              </AppText>
            </Pressable>
          </Link>
        </View>

        <View style={[styles.hintCard, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
          <AppText variant="label" color="primary">
            {IS_MOCK_API ? 'Demo mode' : 'How to sign in'}
          </AppText>
          <AppText variant="caption" color="textSecondary" style={{ lineHeight: 18 }}>
            Your society admin sets your wing, flat number and password when adding you as a member.
            {IS_MOCK_API ? '\nDemo: Green Valley Residency · Wing A · Flat 203 · resident123' : ''}
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: Spacing.onehalf },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
    backgroundColor: Brand.lime,
  },
  formCard: {
    gap: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
  },
  input: {
    minHeight: 54,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.onehalf,
    borderRadius: Radius.sm,
  },
  hintCard: {
    gap: Spacing.half,
    padding: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
});
