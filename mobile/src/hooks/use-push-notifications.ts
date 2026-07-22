import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { api } from '@/api/client';

const EAS_PROJECT_ID = 'fe5dd236-8e6e-4f90-83a4-c1fed8534bdc';

/** Expo Go cannot register remote push tokens (SDK 53+). Use an EAS dev/production build. */
function isExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo'
  );
}

/** Register Expo push token with the API when the user is signed in. */
export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !Device.isDevice || isExpoGo()) return;

    let cancelled = false;

    (async () => {
      // Lazy-load so Expo Go never imports expo-notifications (it throws on load).
      const Notifications = await import('expo-notifications');

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
        });
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
      if (cancelled) return;

      await api.post('/notifications/register-device', {
        expoToken: token.data,
        platform: Platform.OS,
      });
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
