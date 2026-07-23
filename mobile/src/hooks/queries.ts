/** TanStack Query hooks for every backend resource. */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  dashboardApi,
  eventApi,
  invoiceApi,
  noticeApi,
  paymentApi,
  receiptApi,
  societyApi,
  visitorApi,
} from '@/api/endpoints';
import type { InvoiceFilters, PayRequest } from '@/api/types';
import { useAuth } from '@/context/auth';

/** Every key is namespaced by user+society so account switches cannot leak cache. */
export const queryKeys = {
  root: (userId: string, societyId: string) => ['session', userId, societyId] as const,
  dashboard: (userId: string, societyId: string) => [...queryKeys.root(userId, societyId), 'dashboard'] as const,
  settings: (userId: string, societyId: string) =>
    [...queryKeys.root(userId, societyId), 'society-settings'] as const,
  invoices: (userId: string, societyId: string, filters: InvoiceFilters) =>
    [...queryKeys.root(userId, societyId), 'invoices', filters.status ?? 'All', filters.month ?? ''] as const,
  invoice: (userId: string, societyId: string, invoiceNo: string) =>
    [...queryKeys.root(userId, societyId), 'invoice', invoiceNo] as const,
  receipts: (userId: string, societyId: string) => [...queryKeys.root(userId, societyId), 'receipts'] as const,
  receipt: (userId: string, societyId: string, receiptNo: string) =>
    [...queryKeys.root(userId, societyId), 'receipt', receiptNo] as const,
  notices: (userId: string, societyId: string) => [...queryKeys.root(userId, societyId), 'notices'] as const,
  notice: (userId: string, societyId: string, id: string) =>
    [...queryKeys.root(userId, societyId), 'notice', id] as const,
  events: (userId: string, societyId: string) => [...queryKeys.root(userId, societyId), 'events'] as const,
  event: (userId: string, societyId: string, id: string) =>
    [...queryKeys.root(userId, societyId), 'event', id] as const,
  visitors: (userId: string, societyId: string) => [...queryKeys.root(userId, societyId), 'visitors'] as const,
};

function useSessionScope() {
  const { user, isAuthenticated } = useAuth();
  return {
    enabled: isAuthenticated && !!user,
    userId: user?.id ?? '',
    societyId: user?.societyId ?? '',
  };
}

export function useDashboard() {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.dashboard(userId, societyId),
    queryFn: dashboardApi.summary,
    enabled,
  });
}

export function useSocietySettings() {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.settings(userId, societyId),
    queryFn: societyApi.settings,
    enabled,
  });
}

export function useInvoices(filters: InvoiceFilters = {}) {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.invoices(userId, societyId, filters),
    queryFn: () => invoiceApi.list(filters),
    enabled,
    /** Keep list visible while status/month filters change — safe (same resource shape). */
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(invoiceNo: string) {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.invoice(userId, societyId, invoiceNo),
    queryFn: () => invoiceApi.byNo(invoiceNo),
    enabled: enabled && !!invoiceNo,
  });
}

export function useReceipts() {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.receipts(userId, societyId),
    queryFn: receiptApi.list,
    enabled,
  });
}

export function useReceipt(receiptNo: string) {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.receipt(userId, societyId, receiptNo),
    queryFn: () => receiptApi.byNo(receiptNo),
    enabled: enabled && !!receiptNo,
  });
}

export function useNotices() {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.notices(userId, societyId),
    queryFn: noticeApi.list,
    enabled,
  });
}

export function useNotice(id: string) {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.notice(userId, societyId, id),
    queryFn: () => noticeApi.byId(id),
    enabled: enabled && !!id,
  });
}

export function useEvents() {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.events(userId, societyId),
    queryFn: eventApi.list,
    enabled,
  });
}

export function useEvent(id: string) {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.event(userId, societyId, id),
    queryFn: () => eventApi.byId(id),
    enabled: enabled && !!id,
  });
}

export function useVisitors() {
  const { enabled, userId, societyId } = useSessionScope();
  return useQuery({
    queryKey: queryKeys.visitors(userId, societyId),
    queryFn: visitorApi.list,
    enabled,
  });
}

export function usePayInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const societyId = user?.societyId ?? '';
  return useMutation({
    mutationFn: (request: PayRequest) =>
      paymentApi.pay(request, {
        userName: user?.name,
        userEmail: user?.email,
        userPhone: user?.phone,
        isAdmin: user?.role === 'admin',
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.invoice(userId, societyId, result.invoice.invoiceNo), result.invoice);
      queryClient.setQueryData(queryKeys.receipt(userId, societyId, result.receipt.receiptNo), result.receipt);
      // Refetch even inactive list caches so Bills/Receipts update immediately after pay.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.root(userId, societyId),
        refetchType: 'all',
      });
    },
  });
}
