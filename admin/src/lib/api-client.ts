/**
 * Fetch wrapper to the live SocietyOne Nest API.
 *
 * Tokens are persisted in localStorage (so_access_token / so_refresh_token /
 * so_user) so a page reload keeps the session. This file is the ONLY place
 * that talks HTTP to the Nest API — every service module goes through it.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api/v1";

function apiUnreachableMessage(): string {
  if (API_BASE_URL.includes("localhost")) {
    return `Cannot reach the API (${API_BASE_URL}). Start Nest: cd api && npm run start:dev`;
  }
  if (API_BASE_URL.startsWith("/")) {
    return `Cannot reach the API (${API_BASE_URL}). On Vercel, set API_PROXY_TARGET to your Render API URL (e.g. https://your-api.onrender.com) and redeploy.`;
  }
  return `Cannot reach the API (${API_BASE_URL}). Check the Nest API is live on Render and CORS_ORIGINS includes this admin URL.`;
}

export const TOKEN_KEYS = {
  access: "so_access_token",
  refresh: "so_refresh_token",
  user: "so_user",
} as const;

export type ApiRole =
  | "SUPER_ADMIN"
  | "SOCIETY_ADMIN"
  | "COMMITTEE_MEMBER"
  | "SECURITY_GUARD"
  | "RESIDENT";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: ApiRole;
  societyId: string | null;
  memberId: string | null;
  phone?: string | null;
  wing?: string | null;
  flatNo?: string | null;
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore (private mode / quota) */
  }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getAccessToken(): string | null {
  return readStorage(TOKEN_KEYS.access);
}

export function getRefreshToken(): string | null {
  return readStorage(TOKEN_KEYS.refresh);
}

export function hasAccessToken(): boolean {
  return !!getAccessToken();
}

export function getStoredUser(): ApiUser | null {
  const raw = readStorage(TOKEN_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}

export function setApiSession(
  tokens: { accessToken: string; refreshToken: string },
  user: ApiUser
): void {
  writeStorage(TOKEN_KEYS.access, tokens.accessToken);
  writeStorage(TOKEN_KEYS.refresh, tokens.refreshToken);
  writeStorage(TOKEN_KEYS.user, JSON.stringify(user));
}

export function clearApiSession(): void {
  removeStorage(TOKEN_KEYS.access);
  removeStorage(TOKEN_KEYS.refresh);
  removeStorage(TOKEN_KEYS.user);
}

/** Notifies live-data hooks/services to re-read their caches. Prefer a specific scope. */
export { notifyDataUpdated } from "@/lib/live-data-events";
export type { LiveDataScope } from "@/lib/live-data-events";
import { notifyDataUpdated } from "@/lib/live-data-events";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return apiUnreachableMessage();
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    writeStorage(TOKEN_KEYS.access, data.accessToken);
    writeStorage(TOKEN_KEYS.refresh, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

interface ApiFetchOptions extends RequestInit {
  /** Attach the bearer token (default true). Set false for /auth/login etc. */
  auth?: boolean;
}

export async function apiFetch<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = init;

  const doFetch = async (token: string | null): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers as Record<string, string> | undefined),
    };
    if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;
    const url = `${API_BASE_URL}${path}`;
    try {
      return await fetch(url, { ...rest, headers: finalHeaders });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ApiError(0, apiUnreachableMessage());
      }
      throw error;
    }
  };

  let res = await doFetch(auth ? getAccessToken() : null);

  if (res.status === 401 && auth && !path.startsWith("/auth/")) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      clearApiSession();
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {
      /* body wasn't JSON */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""
  );
  if (!entries.length) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}

/* ------------------------------------------------------------------ */
/* Domain API groups — thin wrappers over Nest routes                  */
/* ------------------------------------------------------------------ */

export interface ApiLoginResult {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<ApiLoginResult>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    }),
  forgotPassword: (email: string) =>
    apiFetch<{ success: boolean }>("/auth/forgot-password", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    apiFetch<{ success: boolean }>("/auth/reset-password", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ token, password }),
    }),
  logout: () => {
    const refreshToken = getRefreshToken();
    return apiFetch<{ success: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    }).catch(() => undefined);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw Nest row, mapped by callers
  me: () => apiFetch<any>("/me"),
};

export const membersApi = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list: (societyId?: string) => apiFetch<any[]>(`/members${qs({ societyId })}`),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (input: Record<string, unknown>, societyId?: string) =>
    apiFetch<any>(`/members${qs({ societyId })}`, { method: "POST", body: JSON.stringify(input) }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (id: string, input: Record<string, unknown>, societyId?: string) =>
    apiFetch<any>(`/members/${id}${qs({ societyId })}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string, societyId?: string) =>
    apiFetch<{ success: boolean }>(`/members/${id}${qs({ societyId })}`, { method: "DELETE" }),
};

export const societiesApi = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list: () => apiFetch<any[]>("/societies"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  me: () => apiFetch<any>("/societies/me"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getById: (id: string) => apiFetch<any>(`/societies/${id}`),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (input: Record<string, unknown>) =>
    apiFetch<any>("/societies", { method: "POST", body: JSON.stringify(input) }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (id: string, input: Record<string, unknown>) =>
    apiFetch<any>(`/societies/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
};

export const settingsApi = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (societyId?: string) => apiFetch<any>(`/society/settings${qs({ societyId })}`),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (input: Record<string, unknown>, societyId?: string) =>
    apiFetch<any>(`/society/settings${qs({ societyId })}`, { method: "PATCH", body: JSON.stringify(input) }),
};

export const invoicesApi = {
  list: (params: { societyId?: string; status?: string; month?: string } = {}) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiFetch<any[]>(`/invoices${qs(params)}`),
  byNo: (invoiceNo: string, societyId?: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiFetch<any>(`/invoices/${encodeURIComponent(invoiceNo)}${qs({ societyId })}`),
  generateMonthly: (month: string, societyId?: string) =>
    apiFetch<{ month: string; generated: number; skipped: number; invoices: unknown[] }>(
      `/invoices/generate-monthly${qs({ societyId })}`,
      { method: "POST", body: JSON.stringify({ month }) }
    ),
  remove: (invoiceNo: string, societyId?: string) =>
    apiFetch<{ success: boolean }>(
      `/invoices/${encodeURIComponent(invoiceNo)}${qs({ societyId })}`,
      { method: "DELETE" }
    ),
};

export const receiptsApi = {
  list: (params: { societyId?: string; month?: string } = {}) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiFetch<any[]>(`/receipts${qs(params)}`),
  byNo: (receiptNo: string, societyId?: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiFetch<any>(`/receipts/${encodeURIComponent(receiptNo)}${qs({ societyId })}`),
};

export const communityApi = {
  notices: () => apiFetch<any[]>("/notices"),
  createNotice: (input: Record<string, unknown>) =>
    apiFetch<any>("/notices", { method: "POST", body: JSON.stringify(input) }),
  updateNotice: (id: string, input: Record<string, unknown>) =>
    apiFetch<any>(`/notices/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteNotice: (id: string) =>
    apiFetch<{ success: boolean }>(`/notices/${encodeURIComponent(id)}`, { method: "DELETE" }),
  events: () => apiFetch<any[]>("/events"),
  createEvent: (input: Record<string, unknown>) =>
    apiFetch<any>("/events", { method: "POST", body: JSON.stringify(input) }),
  updateEvent: (id: string, input: Record<string, unknown>) =>
    apiFetch<any>(`/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteEvent: (id: string) =>
    apiFetch<{ success: boolean }>(`/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const visitorsApi = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list: (societyId?: string) => apiFetch<any[]>(`/visitors${qs({ societyId })}`),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (input: Record<string, unknown>, societyId?: string) =>
    apiFetch<any>(`/visitors${qs({ societyId })}`, { method: "POST", body: JSON.stringify(input) }),
  remove: (id: string, societyId?: string) =>
    apiFetch<{ success: boolean }>(`/visitors/${id}${qs({ societyId })}`, { method: "DELETE" }),
};

/* ------------------------------------------------------------------ */
/* Tiny synchronous-facade cache for legacy services                   */
/* ------------------------------------------------------------------ */

/**
 * Many existing service modules (invoice/notice/event/visitor/settings) are
 * called synchronously all over the UI. Rather than rewrite every caller to
 * be async, each of those services keeps one of these caches: `get()` is
 * synchronous (returns the last known value), while `refresh()` fetches the
 * live value from the Nest API in the background and calls
 * `notifyDataUpdated()` so hooks that listen for the "societyone-storage"
 * event re-render with fresh data. Nothing here touches localStorage for
 * business data — only the auth tokens above are persisted.
 */
export function createLiveCache<T>() {
  let value: T | undefined;
  let loading = false;

  return {
    get(): T | undefined {
      return value;
    },
    set(next: T): void {
      value = next;
      notifyDataUpdated();
    },
    async refresh(loader: () => Promise<T>): Promise<void> {
      if (loading) return;
      loading = true;
      try {
        value = await loader();
        notifyDataUpdated();
      } catch {
        /* keep last known value on failure */
      } finally {
        loading = false;
      }
    },
  };
}
