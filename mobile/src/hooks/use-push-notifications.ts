import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { api } from '@/api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const EAS_PROJECT_ID = 'fe5dd236-8e6e-4f90-83a4-c1fed8534bdc';

/** Register Expo push token with the API when the user is signed in. */
export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !Device.isDevice) return;

    let cancelled = false;

    (async () => {
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
