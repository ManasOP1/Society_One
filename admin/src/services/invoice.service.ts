/**
 * Invoices — list/get/generate-monthly are backed by the live Nest API
 * (`GET /invoices`, `GET /invoices/:invoiceNo`, `POST /invoices/generate-monthly`).
 *
 * The Nest API does not expose endpoints for duplicating an invoice,
 * changing its status, recording a manual payment, or deleting it, so
 * those operations keep working against an in-memory cache only (no
 * longer persisted to localStorage / no fake seed data). That means
 * demo payment actions are safe to explore within a session but are not
 * written back to Supabase — a real payment must go through
 * `POST /payments/orders` (Razorpay) instead.
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
function mapApiInvoice(raw: any, societyId: string): Invoice {
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
    societyId,
    societyName: raw?.societyName ?? "",
    societyAddress: raw?.societyAddress ?? "",
    registrationNo: raw?.registrationNo ?? "",
    panNumber: raw?.panNumber ?? "",
    memberId: raw?.memberId ?? "",
    ownerName: raw?.member?.ownerName ?? "",
    tenantName: raw?.tenantName ?? "—",
    flatNo: raw?.flat?.flatNo ?? "",
    wing: raw?.flat?.wing?.code ?? "",
    areaSqft: Number(raw?.flat?.areaSqft) || 0,
    ownerAddress: raw?.ownerAddress ?? "",
    mobile: raw?.member?.phone ?? "",
    email: raw?.member?.email ?? "",
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
  persistInvoices(invoice.societyId);
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

  async generateMonthly(societyId: string, month: string): Promise<Invoice[]> {
    try {
      const res = await invoicesApi.generateMonthly(month, societyId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = (res.invoices as any[]).map((raw) => mapApiInvoice(raw, societyId));
      created.forEach(upsert);
      notifyDataUpdated("invoices");
      return created;
    } catch (e) {
      console.error("Failed to generate invoices:", apiErrorMessage(e));
      throw new Error(apiErrorMessage(e));
    }
  },

  /** Local-only (no API endpoint) — duplicates within the in-memory cache for this session. */
  duplicate(invoiceNo: string, _actor: string): Invoice | null {
    const src = this.getByNo(invoiceNo);
    if (!src) return null;
    const copy: Invoice = {
      ...src,
      id: uid("inv"),
      invoiceNo: `${src.invoiceNo}-COPY`,
      paidAmount: 0,
      outstanding: src.totalAmount,
      status: "Pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cancelledAt: null,
    };
    upsert(copy);
    notifyDataUpdated("invoices");
    return copy;
  },

  /** Local-only (no API endpoint) — updates the in-memory cache for this session only. */
  updateStatus(
    invoiceNo: string,
    status: InvoiceStatus,
    _actor: string,
    paidAmount?: number
  ): Invoice | null {
    const inv = this.getByNo(invoiceNo);
    if (!inv) return null;
    let next = { ...inv, status, updatedAt: new Date().toISOString() };
    if (status === "Cancelled") next.cancelledAt = new Date().toISOString();
    else if (status === "Paid") {
      next.paidAmount = next.totalAmount;
      next.outstanding = 0;
    } else if (status === "Partial") {
      next.paidAmount = paidAmount ?? Math.max(1, Math.round(next.totalAmount / 2));
      next.outstanding = Math.max(0, next.totalAmount - next.paidAmount);
    } else if (status === "Pending") {
      next.paidAmount = 0;
      next.outstanding = next.totalAmount;
    }
    upsert(next);
    notifyDataUpdated("invoices");
    return next;
  },

  /** Local-only (no API endpoint) — applies a payment to the in-memory cache for this session only. */
  applyPayment(invoiceNo: string, amount: number, _actor: string): Invoice | null {
    const inv = this.getByNo(invoiceNo);
    if (!inv || inv.status === "Cancelled") return inv ?? null;
    const paidAmount = Math.min(inv.totalAmount, inv.paidAmount + amount);
    const outstanding = Math.max(0, inv.totalAmount - paidAmount);
    const status: InvoiceStatus = outstanding <= 0 ? "Paid" : "Partial";
    const next = { ...inv, paidAmount, outstanding, status, updatedAt: new Date().toISOString() };
    upsert(next);
    notifyDataUpdated("invoices");
    return next;
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
