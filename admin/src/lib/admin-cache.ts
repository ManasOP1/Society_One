/** Persisted admin data cache (localStorage) — survives reloads, shown instantly while API refreshes. */

const PREFIX = "so_admin_cache_v1";

export function cacheKey(...parts: string[]): string {
  return parts.filter(Boolean).join(":");
}

export function readAdminCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeAdminCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function clearAdminCachePrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const fullPrefix = `${PREFIX}:${prefix}`;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(fullPrefix)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Remove all cached data for one society (on logout). */
export function clearSocietyAdminCache(societyId: string): void {
  for (const part of ["society", "members", "settings", "invoices", "visitors"]) {
    clearAdminCachePrefix(cacheKey(part, societyId));
  }
}
