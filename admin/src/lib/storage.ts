/** localStorage helpers — replace with API client later. */

export function storageGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function storageSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    const isQuota =
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED");
    if (isQuota) {
      throw new Error(
        "Browser storage is full. Remove an unused logo or clear old demo data, then try again."
      );
    }
    throw error;
  }
}

export function storageRemove(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

export const STORAGE_KEYS = {
  session: "societyone-session",
  superSession: "societyone-super-session",
  societies: "societyone-societies-v1",
  members: "societyone-members",
  invoices: "societyone-invoices-v2",
  receipts: "societyone-receipts-v1",
  expenses: "societyone-expenses-v1",
  settings: "societyone-settings-v1",
  audit: "societyone-audit-v1",
  whatsapp: "societyone-whatsapp-v1",
  events: "societyone-events-v1",
  notices: "societyone-notices-v1",
  visitors: "societyone-visitors-v1",
} as const;
