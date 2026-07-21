import { focusManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

/** Lets TanStack Query pause/resume polling when the app goes to background. */
export function useAppFocusManager() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const onChange = (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    };

    onChange(AppState.currentState);
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);
}
