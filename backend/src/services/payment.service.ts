import { STORAGE_KEYS, storageGet, storageSet } from "@/lib/storage";
import { settingsService } from "@/services/settings.service";
import { invoiceService } from "@/services/invoice.service";
import { auditService } from "@/services/audit.service";
import type { Invoice, PaymentMode, Receipt, SimulatedPaymentResult } from "@/types";

function getAll(): Receipt[] {
  return storageGet<Receipt[]>(STORAGE_KEYS.receipts, []);
}

function saveAll(list: Receipt[]) {
  storageSet(STORAGE_KEYS.receipts, list);
}

function pad(n: number, len = 4) {
  return String(n).padStart(len, "0");
}

function nextReceiptNo(societyId: string, month: string): string {
  const settings = settingsService.get(societyId);
  const [year, mon] = month.split("-");
  const prefix = `${settings.receiptPrefix}-${year}-${mon}-`;
  const existing = getAll()
    .filter((r) => r.societyId === societyId && r.receiptNo.startsWith(prefix))
    .map((r) => Number(r.receiptNo.slice(prefix.length)) || 0);
  const next = (existing.length ? Math.max(...existing) : 0) + 1;
  return `${prefix}${pad(next)}`;
}

export const receiptService = {
  list(societyId: string): Receipt[] {
    return getAll()
      .filter((r) => r.societyId === societyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getByNo(receiptNo: string): Receipt | null {
    return getAll().find((r) => r.receiptNo === receiptNo) ?? null;
  },

  createFromInvoice(
    invoice: Invoice,
    amount: number,
    mode: PaymentMode,
    actor: string,
    utr?: string
  ): Receipt {
    const receipt: Receipt = {
      id: `rcpt-${Date.now()}`,
      receiptNo: nextReceiptNo(invoice.societyId, invoice.month),
      invoiceNo: invoice.invoiceNo,
      societyId: invoice.societyId,
      societyName: invoice.societyName,
      ownerName: invoice.ownerName,
      flatNo: invoice.flatNo,
      wing: invoice.wing,
      mobile: invoice.mobile,
      amount,
      lateFee: invoice.lateFee,
      totalPaid: amount,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMode: mode,
      utr: utr ?? `MOCK${Date.now().toString().slice(-10)}`,
      bank: settingsService.get(invoice.societyId).bankName,
      collectedBy: actor,
      month: invoice.month,
      createdAt: new Date().toISOString(),
    };
    saveAll([receipt, ...getAll()]);
    auditService.log({
      societyId: invoice.societyId,
      action: "Receipt Generated",
      entityType: "receipt",
      entityId: receipt.receiptNo,
      details: `${receipt.receiptNo} for ${invoice.invoiceNo}`,
      actor,
    });
    return receipt;
  },
};

export const paymentService = {
  /** Simulated gateway — no real money movement */
  simulatePay(
    invoiceNo: string,
    amount: number,
    mode: PaymentMode = "UPI",
    actor = "Resident"
  ): SimulatedPaymentResult {
    const invoice = invoiceService.getByNo(invoiceNo);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (invoice.status === "Cancelled") {
      throw new Error("Cannot pay a cancelled invoice");
    }
    if (invoice.status === "Paid" || invoice.outstanding <= 0) {
      throw new Error("Invoice already paid");
    }
    const payAmount = Math.min(amount, invoice.outstanding);
    const utr = `UPI${Date.now().toString().slice(-12)}`;
    const updated = invoiceService.applyPayment(invoiceNo, payAmount, actor);
    if (!updated) throw new Error("Payment failed");
    const receipt = receiptService.createFromInvoice(
      updated,
      payAmount,
      mode,
      actor,
      utr
    );
    return { success: true, receipt, invoice: updated, utr };
  },

  markFullyPaid(invoiceNo: string, actor: string, mode: PaymentMode = "UPI") {
    const invoice = invoiceService.getByNo(invoiceNo);
    if (!invoice) throw new Error("Invoice not found");
    return this.simulatePay(invoiceNo, invoice.outstanding, mode, actor);
  },
};
