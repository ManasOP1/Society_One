"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { settingsService } from "@/services/settings.service";
import type { SocietySettings } from "@/types";

/** Loads society settings — cache first, background refresh on interval/focus. */
export function useLiveSocietySettings(
  societyId: string | undefined
): SocietySettings | null {
  const [settings, setSettings] = useState<SocietySettings | null>(() =>
    societyId ? settingsService.get(societyId) : null
  );

  const reload = useCallback(async () => {
    if (!societyId) {
      setSettings(null);
      return;
    }
    try {
      const next = await settingsService.fetch(societyId, { silent: true });
      setSettings(next);
    } catch {
      setSettings(settingsService.get(societyId));
    }
  }, [societyId]);

  useEffect(() => {
    if (!societyId) {
      setSettings(null);
      return;
    }
    setSettings(settingsService.get(societyId));
    void reload();
  }, [societyId, reload]);

  useLiveRefresh(() => void reload(), !!societyId, {
    scope: "settings",
    immediate: false,
  });

  return settings;
}
