import {
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { Colors, Fonts } from '@/constants/theme';
import { LIVE_SYNC_MS } from '@/constants/live-sync';
import { AuthProvider, useAuth } from '@/context/auth';
import { useAppFocusManager } from '@/hooks/use-app-focus-manager';
import { useLiveSessionSync } from '@/hooks/use-live-session-sync';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** Fresh for 2 minutes — avoid hammering a cold Render free tier. */
      staleTime: LIVE_SYNC_MS,
      /** No global polling; refetch on reconnect / foreground invalidation only. */
      refetchInterval: false,
      refetchIntervalInBackground: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
      /** Keep current UI visible while refetching — no flash to skeleton. */
      placeholderData: keepPreviousData,
    },
  },
});

function LiveSyncLayer() {
  useAppFocusManager();
  useLiveSessionSync();
  return null;
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { isAuthenticated, isRestoring } = useAuth();
  const palette = Colors.light;

  useEffect(() => {
    if (fontsLoaded && !isRestoring) SplashScreen.hideAsync();
  }, [fontsLoaded, isRestoring]);

  if (!fontsLoaded || isRestoring) return null;

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.card,
      text: palette.text,
      border: palette.border,
    },
  };

  const detailOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: palette.card },
    headerTintColor: palette.text,
    headerTitleStyle: { fontFamily: Fonts.semiBold, color: palette.text },
    headerBackButtonDisplayMode: 'minimal' as const,
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="invoice/[invoiceNo]" options={{ ...detailOptions, title: 'Invoice' }} />
          <Stack.Screen name="receipt/[receiptNo]" options={{ ...detailOptions, title: 'Receipt' }} />
          <Stack.Screen name="pay/[invoiceNo]" options={{ ...detailOptions, title: 'Pay Maintenance' }} />
          <Stack.Screen name="notice/[id]" options={{ ...detailOptions, title: 'Notice' }} />
          <Stack.Screen name="event/[id]" options={{ ...detailOptions, title: 'Event' }} />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="login" />
          <Stack.Screen name="forgot-password" options={{ ...detailOptions, title: 'Forgot Password' }} />
          <Stack.Screen name="reset-password" options={{ ...detailOptions, title: 'Reset Password' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  // Never block forever if font loading fails on some platform.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LiveSyncLayer />
        <RootNavigator fontsLoaded={fontsLoaded || timedOut} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
