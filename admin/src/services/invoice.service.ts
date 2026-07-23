/**
 * Invoices — list/get/generate-monthly/remove are backed by the live Nest API.
 * Mark Paid goes through paymentService → POST /payments/manual.
 * Fake local-only status/duplicate actions are no longer used by the UI.
 */

import { invoicesApi, notifyDataUpdated, apiErrorMessage } from "@/lib/api-client";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/types";
import { cacheKey, readAdminCache, writeAdminCache } from "@/lib/admin-cache";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// In-memory + localStorage — survives reload, refreshed from API in background.
let cache: Invoice[] = [];
const loadedFor = new Set<string>();
const loadingFor = new Set<string>();

function hydrateInvoices(societyId: string) {
  if (loadedFor.has(societyId)) return;
  const persisted = readAdminCache<Invoice[]>(cacheKey("invoices", societyId));
  if (persisted?.length) {
    cache = [...cache.filter((i) => i.societyId !== societyId), ...persisted];
    loadedFor.add(societyId);
  }
}

function persistInvoices(societyId: string) {
  writeAdminCache(
    cacheKey("invoices", societyId),
    cache.filter((i) => i.societyId === societyId)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapApiInvoice(raw: any, societyId: string): Invoice {
  const lineItems: InvoiceLineItem[] = Array.isArray(raw?.lineItems)
    ? raw.lineItems.map((li: { id?: string; description: string; amount: number; isDeduction?: boolean }) => ({
        id: li.id ?? uid("li"),
        description: li.description,
        amount: Number(li.amount) || 0,
        isDeduction: !!li.isDeduction,
      }))
    : [];
  const arrearsRe = /arrears|advance|penalty|gst|interest/i;
  const maintenanceItems = lineItems.filter((l) => !arrearsRe.test(l.description));
  const arrearsItems = lineItems.filter((l) => arrearsRe.test(l.description));
  const maintenanceSubtotal = Number(raw?.maintenanceSubtotal) || 0;
  const status: InvoiceStatus = (() => {
    switch (raw?.status ?? raw?.statusCode) {
      case "PARTIAL":
        return "Partial";
      case "PAID":
        return "Paid";
      case "OVERDUE":
        return "Overdue";
      case "CANCELLED":
        return "Cancelled";
      default:
        return "Pending";
    }
  })();
  return {
    id: raw?.id ?? uid("inv"),
    invoiceNo: raw?.invoiceNo ?? "",
    societyId: societyId || raw?.societyId || "",
    societyName: raw?.societyName ?? "",
    societyAddress: raw?.societyAddress ?? "",
    registrationNo: raw?.registrationNo ?? "",
    panNumber: raw?.panNumber ?? "",
    memberId: raw?.memberId ?? "",
    ownerName: raw?.member?.ownerName ?? raw?.ownerName ?? "",
    tenantName: raw?.tenantName ?? "—",
    flatNo: raw?.flat?.flatNo ?? raw?.flatNo ?? "",
    wing: raw?.flat?.wing?.code ?? raw?.wing ?? "",
    areaSqft: Number(raw?.flat?.areaSqft) || 0,
    ownerAddress: raw?.ownerAddress ?? "",
    mobile: raw?.member?.phone ?? raw?.mobile ?? "",
    email: raw?.member?.email ?? raw?.email ?? "",
    month: raw?.month ?? raw?.billingMonth ?? "",
    year: Number(raw?.year) || 0,
    issueDate: raw?.issueDate ? String(raw.issueDate).slice(0, 10) : "",
    dueDate: raw?.dueDate ? String(raw.dueDate).slice(0, 10) : "",
    lineItems,
    maintenanceItems,
    arrearsItems,
    maintenanceSubtotal,
    arrearsSubtotal: Number(raw?.arrearsSubtotal) || 0,
    subtotal: maintenanceSubtotal,
    lateFee: Number(raw?.lateFee) || 0,
    previousOutstanding: Number(raw?.previousOutstanding) || 0,
    advance: Number(raw?.advance) || 0,
    totalAmount: Number(raw?.totalAmount) || 0,
    paidAmount: Number(raw?.paidAmount) || 0,
    outstanding: Number(raw?.outstanding) || 0,
    status,
    notes: raw?.notes ?? "",
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
    cancelledAt: status === "Cancelled" ? raw?.updatedAt ?? null : null,
  };
}

function upsert(invoice: Invoice) {
  const idx = cache.findIndex((i) => i.invoiceNo === invoice.invoiceNo);
  if (idx >= 0) cache[idx] = invoice;
  else cache = [invoice, ...cache];
  if (invoice.societyId) persistInvoices(invoice.societyId);
}

async function refreshList(societyId: string): Promise<void> {
  if (loadingFor.has(societyId)) return;
  loadingFor.add(societyId);
  try {
    const rows = await invoicesApi.list({ societyId });
    const mapped = rows.map((r) => mapApiInvoice(r, societyId));
    cache = [...cache.filter((i) => i.societyId !== societyId), ...mapped];
    loadedFor.add(societyId);
    persistInvoices(societyId);
    notifyDataUpdated("invoices");
  } catch (e) {
    console.error("Failed to load invoices from API:", apiErrorMessage(e));
  } finally {
    loadingFor.delete(societyId);
  }
}

export const invoiceService = {
  list(societyId: string): Invoice[] {
    hydrateInvoices(societyId);
    if (!loadedFor.has(societyId)) void refreshList(societyId);
    return cache
      .filter((i) => i.societyId === societyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Force-fetch invoices from the API (used by live refresh hooks). */
  async reload(societyId: string): Promise<void> {
    await refreshList(societyId);
  },

  getByNo(invoiceNo: string): Invoice | null {
    return cache.find((i) => i.invoiceNo === invoiceNo) ?? null;
  },

  getById(id: string): Invoice | null {
    return cache.find((i) => i.id === id) ?? null;
  },

  /** Fetch full invoice (with line items) from Nest and upsert into cache. */
  async fetchByNo(invoiceNo: string, societyId?: string): Promise<Invoice> {
    const raw = await invoicesApi.byNo(invoiceNo, societyId);
    const mapped = mapApiInvoice(raw, societyId || raw?.societyId || "");
    upsert(mapped);
    notifyDataUpdated("invoices");
    return mapped;
  },

  /** Public shareable invoice (no auth). */
  async fetchPublicByNo(invoiceNo: string): Promise<Invoice> {
    const raw = await invoicesApi.publicByNo(invoiceNo);
    const mapped = mapApiInvoice(raw, raw?.societyId || "");
    upsert(mapped);
    return mapped;
  },

  async generateMonthly(societyId: string, month: string): Promise<Invoice[]> {
    try {
      await invoicesApi.generateMonthly(month, societyId);
      await refreshList(societyId);
      notifyDataUpdated("invoices");
      return cache.filter((i) => i.societyId === societyId && i.month === month);
    } catch (e) {
      console.error("Failed to generate invoices:", apiErrorMessage(e));
      throw new Error(apiErrorMessage(e));
    }
  },

  /** Soft-deletes an invoice in the API and drops it from the local cache. */
  async remove(invoiceNo: string, societyId: string, _actor: string): Promise<boolean> {
    try {
      await invoicesApi.remove(invoiceNo, societyId);
      cache = cache.filter((i) => i.invoiceNo !== invoiceNo);
      persistInvoices(societyId);
      notifyDataUpdated("invoices");
      return true;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  /** Local-only (no API endpoint) — keeps the in-memory cache in sync when settings are edited. */
  syncSocietyBranding(
    societyId: string,
    branding: Partial<Pick<Invoice, "societyName" | "societyAddress" | "registrationNo" | "panNumber">>
  ): void {
    cache = cache.map((inv) =>
      inv.societyId === societyId ? { ...inv, ...branding, updatedAt: new Date().toISOString() } : inv
    );
    persistInvoices(societyId);
    notifyDataUpdated("invoices");
  },

  stats(societyId: string, month?: string) {
    const list = this.list(societyId).filter(
      (i) => i.status !== "Cancelled" && (!month || i.month === month)
    );
    const expected = list.reduce((s, i) => s + i.totalAmount, 0);
    const collected = list.reduce((s, i) => s + i.paidAmount, 0);
    const outstanding = list.reduce((s, i) => s + i.outstanding, 0);
    const pendingFlats = list.filter(
      (i) => i.status === "Pending" || i.status === "Overdue"
    ).length;
    const partial = list.filter((i) => i.status === "Partial").length;
    const late = list.filter((i) => i.status === "Overdue" || i.lateFee > 0).length;
    const today = new Date().toISOString().slice(0, 10);
    const todayCollection = list
      .filter((i) => i.updatedAt.slice(0, 10) === today && i.status === "Paid")
      .reduce((s, i) => s + i.paidAmount, 0);
    return {
      expected,
      collected,
      outstanding,
      percent: expected ? Math.round((collected / expected) * 100) : 0,
      pendingFlats,
      partial,
      late,
      todayCollection,
      count: list.length,
      today,
    };
  },
};
