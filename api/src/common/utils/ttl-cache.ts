/**
 * Process-local TTL cache for hot read paths (dashboard, settings, login lists).
 * Survives across requests on a warm instance; clears naturally after TTL.
 */

type Entry<T> = { value: T; expiresAt: number };

export class TtlCache {
  private readonly store = new Map<string, Entry<unknown>>();

  constructor(private readonly defaultTtlMs: number) {}

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deletePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

/** Shared caches — one Nest process = one cache (correct for single Render instance). */
export const readCache = new TtlCache(45_000);
