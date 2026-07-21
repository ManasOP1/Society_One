import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiErrorMessage } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Fonts, MaxContentWidth, Radius, Spacing, softShadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ResetPasswordScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [token, setToken] = useState(tokenParam ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!token.trim() || password.length < 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword(token.trim(), password);
      router.replace('/login');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
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
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled">
        <AppText variant="title">Reset password</AppText>
        <AppText variant="body" color="textSecondary">
          Paste the reset token from your email and choose a new password.
        </AppText>

        <View style={[styles.card, softShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={{ gap: Spacing.half }}>
            <AppText variant="label">Reset token</AppText>
            <TextInput
              style={inputStyle}
              value={token}
              onChangeText={setToken}
              placeholder="Paste token from email"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
            />
          </View>

          <View style={{ gap: Spacing.half }}>
            <AppText variant="label">New password</AppText>
            <View>
              <TextInput
                style={[...inputStyle, { paddingRight: 52 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <AppText variant="caption" style={{ color: theme.error }}>
              {error}
            </AppText>
          ) : null}

          <Button
            title="Update password"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!token.trim() || password.length < 6}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    gap: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
  },
  input: {
    minHeight: 52,
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
});
