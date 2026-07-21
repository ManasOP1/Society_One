"use client";

import { useEffect } from "react";
import { LIVE_SYNC_DEBOUNCE_MS, LIVE_SYNC_MS } from "@/constants/live-sync";

/** Poll + refetch when the tab gains focus or another screen writes data. */
export function useLiveRefresh(
  callback: () => void | Promise<void>,
  enabled = true,
  intervalMs = LIVE_SYNC_MS
) {
  useEffect(() => {
    if (!enabled) return;

    let inFlight = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (inFlight) return;
      inFlight = true;
      void Promise.resolve(callback()).finally(() => {
        inFlight = false;
      });
    };

    const scheduleDebounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(run, LIVE_SYNC_DEBOUNCE_MS);
    };

    run();
    const id = window.setInterval(run, intervalMs);
    window.addEventListener("societyone-storage", scheduleDebounced);
    window.addEventListener("focus", scheduleDebounced);

    return () => {
      window.clearInterval(id);
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("societyone-storage", scheduleDebounced);
      window.removeEventListener("focus", scheduleDebounced);
    };
  }, [callback, enabled, intervalMs]);
}
