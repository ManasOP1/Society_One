import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';

const EAS_PROJECT_ID = 'fe5dd236-8e6e-4f90-83a4-c1fed8534bdc';

/** Expo Go cannot register remote push tokens (SDK 53+). Use an EAS build. */
function isExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo'
  );
}

type PushData = {
  type?: string;
  noticeId?: string;
  eventId?: string;
  visitorId?: string;
  id?: string;
};

function notificationReadId(data?: PushData): string | null {
  if (!data?.type) return null;
  if (data.type === 'visitor') {
    const id = data.visitorId || data.id;
    return id ? `visitor:${id}` : null;
  }
  if (data.type === 'notice') return data.noticeId || data.id || null;
  if (data.type === 'event') return data.eventId || data.id || null;
  return null;
}

/**
 * Register Expo push token and handle taps.
 * Works when app is open, backgrounded, or killed (system tray) —
 * same pattern as Zomato-style alerts, as long as this is an EAS APK/IPA
 * (not Expo Go) and notification permission is granted.
 */
export function usePushNotifications(enabled: boolean) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { markRead } = useUnreadNotifications();

  useEffect(() => {
    if (!enabled || !Device.isDevice || isExpoGo()) return;

    let cancelled = false;
    let receivedSub: { remove: () => void } | undefined;
    let responseSub: { remove: () => void } | undefined;

    (async () => {
      let Notifications: typeof import('expo-notifications');
      try {
        Notifications = await import('expo-notifications');
      } catch {
        return;
      }

      // Show banner/sound even while the app is open.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted' || cancelled) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('societyone-alerts', {
          name: 'Society alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4F46E5',
          bypassDnd: false,
          showBadge: true,
          enableVibrate: true,
          enableLights: true,
        });
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: EAS_PROJECT_ID,
      });
      if (cancelled) return;

      await api.post('/notifications/register-device', {
        expoToken: token.data,
        platform: Platform.OS,
      });

      // Fresh data when a push arrives (foreground or background wake).
      receivedSub = Notifications.addNotificationReceivedListener(() => {
        void queryClient.invalidateQueries({ queryKey: ['notices'] });
        void queryClient.invalidateQueries({ queryKey: ['events'] });
        void queryClient.invalidateQueries({ queryKey: ['visitors'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      });

      // User tapped a system notification (app was closed or in tray).
      responseSub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data as
            | PushData
            | undefined;
          const readId = notificationReadId(data);
          if (readId) void markRead(readId);

          void queryClient.invalidateQueries({ queryKey: ['notices'] });
          void queryClient.invalidateQueries({ queryKey: ['events'] });
          void queryClient.invalidateQueries({ queryKey: ['visitors'] });

          if (!data?.type) {
            router.push('/community');
            return;
          }
          if (data.type === 'visitor') {
            router.push('/visitors');
            return;
          }
          if (data.type === 'notice') {
            const noticeId = data.noticeId || data.id;
            if (noticeId) {
              router.push({
                pathname: '/notice/[id]',
                params: { id: noticeId },
              });
            } else router.push('/community');
            return;
          }
          if (data.type === 'event') {
            const eventId = data.eventId || data.id;
            if (eventId) {
              router.push({
                pathname: '/event/[id]',
                params: { id: eventId },
              });
            } else router.push('/community');
            return;
          }
          router.push('/community');
        },
      );
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      receivedSub?.remove();
      responseSub?.remove();
    };
  }, [enabled, router, queryClient, markRead]);
}
