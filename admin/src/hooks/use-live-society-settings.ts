"use client";

import { useCallback, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { settingsService } from "@/services/settings.service";
import type { SocietySettings } from "@/types";

/** Loads society settings from the live API and refreshes on focus / storage events. */
export function useLiveSocietySettings(
  societyId: string | undefined
): SocietySettings | null {
  const [settings, setSettings] = useState<SocietySettings | null>(null);

  const reload = useCallback(async () => {
    if (!societyId) {
      setSettings(null);
      return;
    }
    try {
      const next = await settingsService.fetch(societyId);
      setSettings(next);
    } catch {
      /* keep last known value */
    }
  }, [societyId]);

  useLiveRefresh(() => void reload(), !!societyId);

  return settings;
}
