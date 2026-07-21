/**
 * Axios adapter that serves the mock backend when EXPO_PUBLIC_API_BASE_URL is
 * not configured. Implements the same REST contract the real backend will
 * expose, including Bearer-token auth and 401s for expired tokens.
 */

import type { AxiosAdapter, AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError as AxiosErrorCtor } from 'axios';

import { MockApiError, mockDb, verifyToken } from '@/api/mock/db';

const LATENCY_MS = 450;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseUrl(config: InternalAxiosRequestConfig): { path: string; query: URLSearchParams } {
  const raw = config.url ?? '';
  const [pathPart, queryPart] = raw.split('?');
  const query = new URLSearchParams(queryPart ?? '');
  if (config.params) {
    for (const [k, v] of Object.entries(config.params as Record<string, unknown>)) {
      if (v !== undefined && v !== null) query.set(k, String(v));
    }
  }
  return { path: pathPart.replace(/\/+$/, '').replace(/^(?!\/)/, '/'), query };
}

function parseBody(config: InternalAxiosRequestConfig): Record<string, unknown> {
  if (!config.data) return {};
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return config.data as Record<string, unknown>;
}

function bearer(config: InternalAxiosRequestConfig): string | undefined {
  const header = config.headers?.get?.('Authorization') ?? (config.headers as Record<string, unknown>)?.Authorization;
  const value = typeof header === 'string' ? header : undefined;
  return value?.startsWith('Bearer ') ? value.slice(7) : undefined;
}

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config,
  };
}

function reject(config: InternalAxiosRequestConfig, status: number, message: string): AxiosError {
  const response = respond(config, status, { message });
  return new AxiosErrorCtor(
    message,
    status === 401 ? AxiosErrorCtor.ERR_BAD_REQUEST : AxiosErrorCtor.ERR_BAD_RESPONSE,
    config,
    undefined,
    response
  );
}

export const mockAdapter: AxiosAdapter = async (config) => {
  await delay(LATENCY_MS);

  const method = (config.method ?? 'get').toLowerCase();
  const { path, query } = parseUrl(config);
  const body = parseBody(config);

  /* ---- public routes ---- */
  if (method === 'get' && path === '/auth/societies') {
    return respond(config, 200, mockDb.societies());
  }

  if (method === 'get' && path.startsWith('/auth/societies/') && path.endsWith('/wings')) {
    const societyId = path.split('/')[3];
    return respond(config, 200, mockDb.wings(societyId));
  }

  if (method === 'post' && path === '/auth/login') {
    if (body.societyId && body.wing && body.flatNo) {
      const result = mockDb.loginResident(
        String(body.societyId),
        String(body.wing),
        String(body.flatNo),
        String(body.password ?? '')
      );
      if (!result) throw reject(config, 401, 'Invalid credentials.');
      return respond(config, 200, result);
    }
    const result = mockDb.login(String(body.email ?? ''), String(body.password ?? ''));
    if (!result) throw reject(config, 401, 'Invalid email or password.');
    return respond(config, 200, result);
  }

  if (method === 'post' && path === '/auth/refresh') {
    const result = mockDb.refresh(String(body.refreshToken ?? ''));
    if (!result) throw reject(config, 401, 'Session expired. Please sign in again.');
    return respond(config, 200, result);
  }

  /* ---- authenticated routes ---- */
  const userId = verifyToken(bearer(config), 'access');
  if (!userId) throw reject(config, 401, 'Unauthorized');

  try {
    if (method === 'get') {
      switch (path) {
        case '/me':
          return respond(config, 200, mockDb.me(userId));
        case '/society/settings':
          return respond(config, 200, mockDb.settings(userId));
        case '/dashboard':
          return respond(config, 200, mockDb.dashboard(userId));
        case '/invoices':
          return respond(config, 200, mockDb.invoices(userId, {
            status: query.get('status') ?? undefined,
            month: query.get('month') ?? undefined,
          }));
        case '/receipts':
          return respond(config, 200, mockDb.receipts(userId));
        case '/notices':
          return respond(config, 200, mockDb.notices(userId));
        case '/events':
          return respond(config, 200, mockDb.events(userId));
        case '/visitors':
          return respond(config, 200, mockDb.visitors(userId));
      }

      const invoiceMatch = path.match(/^\/invoices\/(.+)$/);
      if (invoiceMatch) {
        const inv = mockDb.invoiceByNo(userId, decodeURIComponent(invoiceMatch[1]));
        if (!inv) throw new MockApiError(404, 'Invoice not found');
        return respond(config, 200, inv);
      }

      const receiptMatch = path.match(/^\/receipts\/(.+)$/);
      if (receiptMatch) {
        const rcpt = mockDb.receiptByNo(userId, decodeURIComponent(receiptMatch[1]));
        if (!rcpt) throw new MockApiError(404, 'Receipt not found');
        return respond(config, 200, rcpt);
      }

      const noticeMatch = path.match(/^\/notices\/(.+)$/);
      if (noticeMatch) {
        const notice = mockDb.noticeById(userId, decodeURIComponent(noticeMatch[1]));
        if (!notice) throw new MockApiError(404, 'Notice not found');
        return respond(config, 200, notice);
      }

      const eventMatch = path.match(/^\/events\/(.+)$/);
      if (eventMatch) {
        const event = mockDb.eventById(userId, decodeURIComponent(eventMatch[1]));
        if (!event) throw new MockApiError(404, 'Event not found');
        return respond(config, 200, event);
      }
    }

    if (method === 'post' && path === '/payments') {
      const result = mockDb.pay(
        userId,
        String(body.invoiceNo ?? ''),
        Number(body.amount ?? 0),
        (body.mode as never) ?? 'UPI'
      );
      return respond(config, 200, result);
    }
  } catch (error) {
    if (error instanceof MockApiError) throw reject(config, error.status, error.message);
    throw error;
  }

  throw reject(config, 404, `No mock handler for ${method.toUpperCase()} ${path}`);
};

export type { AxiosRequestConfig };
