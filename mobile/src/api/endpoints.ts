/** Typed endpoint functions — the only place the app touches raw HTTP paths. */

import { api, IS_MOCK_API } from '@/api/client';
import { unwrapListPayload } from '@/api/list-payload';
import {
  mapAuthUser,
  mapDashboard,
  mapEvent,
  mapInvoice,
  mapLoginResponse,
  mapNotice,
  mapReceipt,
  mapSettings,
  mapVisitor,
  type ApiLoginResponse,
} from '@/api/mappers';
import { tokenStore } from '@/api/token-store';
import type {
  AuthUser,
  DashboardSummary,
  Invoice,
  InvoiceFilters,
  LoginResponse,
  PayRequest,
  PayResponse,
  Receipt,
  SocietyEvent,
  SocietyNotice,
  SocietySettings,
  SocietyVisitor,
} from '@/api/types';
import {
  isRazorpayCancelled,
  isRazorpayCheckoutAvailable,
  openRazorpayCheckout,
} from '@/utils/razorpay-checkout';

export { unwrapListPayload } from '@/api/list-payload';

export type ResidentLoginInput = {
  societyId: string;
  wing: string;
  flatNo: string;
  password: string;
};

export const authApi = {
  societies: () =>
    api
      .get<{ id: string; name: string }[] | { data: { id: string; name: string }[] }>('/auth/societies')
      .then((r) => unwrapListPayload<{ id: string; name: string }>(r.data)),
  wings: (societyId: string) =>
    api
      .get<{ id: string; code: string; name: string | null }[] | { data: { id: string; code: string; name: string | null }[] }>(
        `/auth/societies/${encodeURIComponent(societyId)}/wings`
      )
      .then((r) =>
        unwrapListPayload<{ id: string; code: string; name: string | null }>(r.data)
      ),
  loginResident: (input: ResidentLoginInput) =>
    api
      .post<ApiLoginResponse>('/auth/login', input)
      .then((r) => mapLoginResponse(r.data)) as Promise<LoginResponse>,
  logout: () => {
    const refreshTokenPromise = tokenStore.getRefreshToken();
    return refreshTokenPromise.then((refreshToken) =>
      api.post('/auth/logout', refreshToken ? { refreshToken } : {}).catch(() => undefined)
    );
  },
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data as { success: boolean }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }).then((r) => r.data as { success: boolean }),
  me: () => api.get<Record<string, unknown>>('/me').then((r) => mapAuthUser(r.data as never) as AuthUser),
};

export const societyApi = {
  settings: () =>
    api.get<Record<string, unknown>>('/society/settings').then((r) => mapSettings(r.data) as SocietySettings),
};


export const dashboardApi = {
  summary: () =>
    api
      .get<Record<string, unknown>>('/dashboard')
      .then((r) => mapDashboard(r.data) as DashboardSummary),
};

export const invoiceApi = {
  list: (filters: InvoiceFilters = {}) =>
    api
      .get<Record<string, unknown>[] | { data: Record<string, unknown>[] }>('/invoices', {
        params: {
          limit: 100,
          status: filters.status && filters.status !== 'All' ? filters.status : undefined,
          month: filters.month || undefined,
        },
      })
      .then((r) =>
        unwrapListPayload<Record<string, unknown>>(r.data).map(mapInvoice)
      ) as Promise<Invoice[]>,
  byNo: (invoiceNo: string) =>
    api
      .get<Record<string, unknown>>(`/invoices/${encodeURIComponent(invoiceNo)}`)
      .then((r) => mapInvoice(r.data)) as Promise<Invoice>,
};

/**
 * Residents: Razorpay Checkout (native) → verify signature → receipt.
 * Admins: manual collection endpoint for cash / cheque / offline modes.
 */
export const paymentApi = {
  pay: async (request: PayRequest, ctx?: { userName?: string; userEmail?: string; userPhone?: string; societyName?: string; isAdmin?: boolean }): Promise<PayResponse> => {
    if (IS_MOCK_API) {
      const { data } = await api.post<PayResponse>('/payments', request);
      return data;
    }

    if (ctx?.isAdmin) {
      const { data } = await api.post<Record<string, unknown>>('/payments/manual', {
        invoiceNo: request.invoiceNo,
        amount: request.amount,
        mode: request.mode,
      });
      return {
        success: true,
        utr: String(data.utr ?? ''),
        invoice: mapInvoice(data.invoice as Record<string, unknown>),
        receipt: mapReceipt(data.receipt as Record<string, unknown>),
      };
    }

    // Online Razorpay — disabled until post-deploy enable
    const { data: payConfig } = await api.get<{
      razorpayEnabled?: boolean;
      onlinePaymentsEnabled?: boolean;
      message?: string;
    }>('/payments/config');
    if (!payConfig.razorpayEnabled && !payConfig.onlinePaymentsEnabled) {
      throw new Error(
        payConfig.message ??
          'Online payments are temporarily disabled. Please pay at the society office.',
      );
    }

    const { data: order } = await api.post<{
      orderId: string;
      amount: number;
      amountPaise: number;
      keyId: string;
      invoiceNo: string;
    }>('/payments/orders', {
      invoiceNo: request.invoiceNo,
      amount: request.amount,
    });

    if (!order.keyId || order.keyId.includes('placeholder')) {
      throw new Error(
        'Razorpay is not configured on the server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to api/.env.',
      );
    }

    if (!isRazorpayCheckoutAvailable()) {
      throw new Error(
        'In-app Razorpay Checkout needs a native build. Run `npx expo run:android` or `npx expo run:ios` — Expo Go cannot open Razorpay.',
      );
    }

    let checkout;
    try {
      checkout = await openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amountPaise: order.amountPaise ?? Math.round(order.amount * 100),
        societyName: ctx?.societyName ?? 'SocietyOne',
        description: `Invoice ${order.invoiceNo}`,
        prefill: {
          name: ctx?.userName,
          email: ctx?.userEmail,
          contact: ctx?.userPhone,
        },
      });
    } catch (error) {
      if (isRazorpayCancelled(error)) {
        throw new Error('Payment cancelled.');
      }
      throw error;
    }

    const { data } = await api.post<Record<string, unknown>>('/payments/verify', {
      orderId: checkout.razorpay_order_id,
      paymentId: checkout.razorpay_payment_id,
      signature: checkout.razorpay_signature,
    });

    return {
      success: true,
      utr: String(data.utr ?? checkout.razorpay_payment_id),
      invoice: mapInvoice(data.invoice as Record<string, unknown>),
      receipt: mapReceipt(data.receipt as Record<string, unknown>),
    };
  },
};

export const receiptApi = {
  list: () =>
    api
      .get<Record<string, unknown>[] | { data: Record<string, unknown>[] }>('/receipts', {
        params: { limit: 100 },
      })
      .then((r) =>
        unwrapListPayload<Record<string, unknown>>(r.data).map(mapReceipt)
      ) as Promise<Receipt[]>,
  byNo: (receiptNo: string) =>
    api
      .get<Record<string, unknown>>(`/receipts/${encodeURIComponent(receiptNo)}`)
      .then((r) => mapReceipt(r.data)) as Promise<Receipt>,
};

export const noticeApi = {
  list: () =>
    api
      .get<Record<string, unknown>[] | { data: Record<string, unknown>[] }>('/notices')
      .then((r) =>
        unwrapListPayload<Record<string, unknown>>(r.data).map(mapNotice)
      ) as Promise<SocietyNotice[]>,
  byId: (id: string) =>
    api
      .get<Record<string, unknown>>(`/notices/${encodeURIComponent(id)}`)
      .then((r) => mapNotice(r.data)) as Promise<SocietyNotice>,
};

export const eventApi = {
  list: () =>
    api
      .get<Record<string, unknown>[] | { data: Record<string, unknown>[] }>('/events')
      .then((r) =>
        unwrapListPayload<Record<string, unknown>>(r.data).map(mapEvent)
      ) as Promise<SocietyEvent[]>,
  byId: (id: string) =>
    api
      .get<Record<string, unknown>>(`/events/${encodeURIComponent(id)}`)
      .then((r) => mapEvent(r.data)) as Promise<SocietyEvent>,
};

export const visitorApi = {
  list: () =>
    api
      .get<Record<string, unknown>[] | { data: Record<string, unknown>[] }>('/visitors')
      .then((r) =>
        unwrapListPayload<Record<string, unknown>>(r.data).map(mapVisitor)
      ) as Promise<SocietyVisitor[]>,
};
