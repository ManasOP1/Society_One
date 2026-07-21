import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

/**
 * Web variant: uses a server snapshot of 'light' so static rendering
 * hydrates consistently, then syncs with the real color scheme.
 */
export function useColorScheme() {
  return useSyncExternalStore(
    (callback) => {
      const subscription = Appearance.addChangeListener(callback);
      return () => subscription.remove();
    },
    () => Appearance.getColorScheme(),
    () => 'light' as const
  );
}
