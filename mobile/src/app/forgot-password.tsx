import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiErrorMessage } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Fonts, MaxContentWidth, Radius, Spacing, softShadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setMessage(
        'If an account exists for this email, reset instructions have been sent. Check your inbox or ask your society admin.'
      );
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
        <AppText variant="title">Forgot password</AppText>
        <AppText variant="body" color="textSecondary">
          Enter the email your society admin registered for your account.
        </AppText>

        <View style={[styles.card, softShadow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <AppText variant="label">Email</AppText>
          <TextInput
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {message ? (
            <AppText variant="caption" style={{ color: theme.success }}>
              {message}
            </AppText>
          ) : null}
          {error ? (
            <AppText variant="caption" style={{ color: theme.error }}>
              {error}
            </AppText>
          ) : null}

          <Button
            title="Send reset link"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!email.trim()}
          />
        </View>

        <Link href="/login">
          <AppText variant="label" style={{ color: theme.primary, textAlign: 'center' }}>
            Back to sign in
          </AppText>
        </Link>
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
    gap: Spacing.onehalf,
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
});
