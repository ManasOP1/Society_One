"use client";

import { useEffect } from "react";
import { LIVE_SYNC_DEBOUNCE_MS, LIVE_SYNC_MS } from "@/constants/live-sync";
import { subscribeLiveData, type LiveDataScope } from "@/lib/live-data-events";

type LiveRefreshOptions = {
  intervalMs?: number;
  /** When false, skip the first fetch on mount (use cached data; poll on interval only). */
  immediate?: boolean;
  /** Only react to matching live-data events (default: all). */
  scope?: LiveDataScope | LiveDataScope[];
};

/** Poll + refetch when the tab gains focus or a scoped data event fires. */
export function useLiveRefresh(
  callback: () => void | Promise<void>,
  enabled = true,
  options: LiveRefreshOptions = {}
) {
  const {
    intervalMs = LIVE_SYNC_MS,
    immediate = false,
    scope = "all",
  } = options;

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

    if (immediate) run();
    const id = window.setInterval(run, intervalMs);
    const unsub = subscribeLiveData(scope, scheduleDebounced);
    window.addEventListener("focus", scheduleDebounced);

    return () => {
      window.clearInterval(id);
      if (debounceTimer) clearTimeout(debounceTimer);
      unsub();
      window.removeEventListener("focus", scheduleDebounced);
    };
  }, [callback, enabled, immediate, intervalMs, scope]);
}
