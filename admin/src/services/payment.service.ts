import { paymentsApi, receiptsApi, apiErrorMessage, notifyDataUpdated } from "@/lib/api-client";
import { invoiceService } from "@/services/invoice.service";
import type { Invoice, PaymentMode, Receipt, SimulatedPaymentResult } from "@/types";
import { cacheKey, readAdminCache, writeAdminCache } from "@/lib/admin-cache";

const MODE_FROM_API: Record<string, PaymentMode> = {
  UPI: "UPI",
  NET_BANKING: "Net Banking",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  CASH: "Cash",
  CHEQUE: "Cheque",
  WALLET: "Wallet",
  OTHER: "Other",
};

let receiptCache: Receipt[] = [];
const receiptsLoadedFor = new Set<string>();
const receiptsLoadingFor = new Set<string>();

function mapApiReceipt(raw: Record<string, unknown>, societyId: string): Receipt {
  const member = raw.member as { ownerName?: string; phone?: string } | undefined;
  const invoice = raw.invoice as { invoiceNo?: string } | undefined;
  const flat = raw.flat as { flatNo?: string; wing?: { code?: string } } | undefined;
  return {
    id: String(raw.id ?? `rcpt-${Date.now()}`),
    receiptNo: String(raw.receiptNo ?? ""),
    invoiceNo: String(raw.invoiceNo ?? invoice?.invoiceNo ?? ""),
    societyId,
    societyName: String(raw.societyName ?? ""),
    ownerName: String(raw.ownerName ?? member?.ownerName ?? ""),
    flatNo: String(raw.flatNo ?? flat?.flatNo ?? ""),
    wing: String(raw.wing ?? flat?.wing?.code ?? ""),
    mobile: String(raw.mobile ?? member?.phone ?? ""),
    amount: Number(raw.amount) || 0,
    lateFee: Number(raw.lateFee) || 0,
    totalPaid: Number(raw.totalPaid) || 0,
    paymentDate: raw.paymentDate ? String(raw.paymentDate).slice(0, 10) : "",
    paymentMode: MODE_FROM_API[String(raw.modeCode ?? raw.mode ?? "OTHER")] ?? "Other",
    utr: String(raw.utr ?? raw.referenceNo ?? ""),
    bank: String(raw.bank ?? ""),
    collectedBy: String(raw.collectedBy ?? "Admin"),
    month: String(raw.month ?? raw.billingMonth ?? ""),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

async function refreshReceipts(societyId: string): Promise<void> {
  if (receiptsLoadingFor.has(societyId)) return;
  receiptsLoadingFor.add(societyId);
  try {
    const rows = await receiptsApi.list({ societyId });
    const mapped = rows.map((r) => mapApiReceipt(r as Record<string, unknown>, societyId));
    receiptCache = [...receiptCache.filter((r) => r.societyId !== societyId), ...mapped];
    receiptsLoadedFor.add(societyId);
    writeAdminCache(cacheKey("receipts", societyId), mapped);
    notifyDataUpdated("receipts");
  } catch (e) {
    console.error("Failed to load receipts from API:", apiErrorMessage(e));
  } finally {
    receiptsLoadingFor.delete(societyId);
  }
}

function hydrateReceipts(societyId: string) {
  if (receiptsLoadedFor.has(societyId)) return;
  const persisted = readAdminCache<Receipt[]>(cacheKey("receipts", societyId));
  if (persisted?.length) {
    receiptCache = [...receiptCache.filter((r) => r.societyId !== societyId), ...persisted];
    receiptsLoadedFor.add(societyId);
  }
}

export const receiptService = {
  list(societyId: string): Receipt[] {
    hydrateReceipts(societyId);
    if (!receiptsLoadedFor.has(societyId)) void refreshReceipts(societyId);
    return receiptCache
      .filter((r) => r.societyId === societyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getByNo(receiptNo: string): Receipt | null {
    return receiptCache.find((r) => r.receiptNo === receiptNo) ?? null;
  },

  async reload(societyId: string): Promise<void> {
    await refreshReceipts(societyId);
  },
};

async function recordPayment(
  invoiceNo: string,
  amount: number,
  mode: PaymentMode,
  actor: string
): Promise<SimulatedPaymentResult> {
  const invoice = invoiceService.getByNo(invoiceNo);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "Cancelled") throw new Error("Cannot pay a cancelled invoice");
  if (invoice.outstanding <= 0) throw new Error("Invoice already paid");

  const payAmount = Math.min(amount, invoice.outstanding);
  const result = await paymentsApi.manual({
    invoiceNo,
    amount: payAmount,
    mode,
  });

  await Promise.all([
    invoiceService.reload(invoice.societyId),
    receiptService.reload(invoice.societyId),
  ]);
  notifyDataUpdated("invoices");
  notifyDataUpdated("receipts");

  const updated = invoiceService.getByNo(invoiceNo);
  if (!updated) throw new Error("Payment recorded but invoice refresh failed");

  const receiptRaw = result?.receipt as Record<string, unknown> | undefined;
  const receipt = receiptRaw
    ? mapApiReceipt(receiptRaw, invoice.societyId)
    : receiptService.list(invoice.societyId).find((r) => r.invoiceNo === invoiceNo) ?? {
        id: `rcpt-${Date.now()}`,
        receiptNo: String(result?.receipt?.receiptNo ?? "—"),
        invoiceNo,
        societyId: invoice.societyId,
        societyName: invoice.societyName,
        ownerName: invoice.ownerName,
        flatNo: invoice.flatNo,
        wing: invoice.wing,
        mobile: invoice.mobile,
        amount: payAmount,
        lateFee: invoice.lateFee,
        totalPaid: payAmount,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMode: mode,
        utr: String(result?.utr ?? ""),
        bank: "",
        collectedBy: actor,
        month: invoice.month,
        createdAt: new Date().toISOString(),
      };

  return {
    success: true,
    receipt,
    invoice: updated,
    utr: String(result?.utr ?? ""),
  };
}

export const paymentService = {
  async simulatePay(
    invoiceNo: string,
    amount: number,
    mode: PaymentMode = "UPI",
    actor = "Admin"
  ): Promise<SimulatedPaymentResult> {
    return recordPayment(invoiceNo, amount, mode, actor);
  },

  async markFullyPaid(
    invoiceNo: string,
    actor: string,
    mode: PaymentMode = "Cash"
  ): Promise<SimulatedPaymentResult> {
    const invoice = invoiceService.getByNo(invoiceNo);
    if (!invoice) throw new Error("Invoice not found");
    return recordPayment(invoiceNo, invoice.outstanding, mode, actor);
  },
};
