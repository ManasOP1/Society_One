/** Data stays fresh for 5 min — avoids hammering free-tier Render/Supabase. */
export const LIVE_SYNC_MS = 300_000;

/** Debounce burst refreshes from focus / cross-screen storage events. */
export const LIVE_SYNC_DEBOUNCE_MS = 3_000;
