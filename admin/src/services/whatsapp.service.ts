import { STORAGE_KEYS, storageGet, storageSet } from "@/lib/storage";
import { auditService } from "@/services/audit.service";
import type { Invoice, WhatsAppLog, WhatsAppMessageStatus } from "@/types";

function getAll(): WhatsAppLog[] {
  return storageGet<WhatsAppLog[]>(STORAGE_KEYS.whatsapp, []);
}

function saveAll(list: WhatsAppLog[]) {
  storageSet(STORAGE_KEYS.whatsapp, list);
}

function origin() {
  if (typeof window === "undefined") return "http://localhost:3000";
  return window.location.origin;
}

export function buildInvoiceLink(invoiceNo: string) {
  return `${origin()}/invoice/${encodeURIComponent(invoiceNo)}`;
}

export function buildReceiptLink(receiptNo: string) {
  return `${origin()}/receipt/${encodeURIComponent(receiptNo)}`;
}

export function buildPaymentLink(invoiceNo: string) {
  return `${origin()}/invoice/${encodeURIComponent(invoiceNo)}?pay=1`;
}

function previewMessage(invoice: Invoice, type: WhatsAppLog["type"]) {
  const invLink = buildInvoiceLink(invoice.invoiceNo);
  const payLink = buildPaymentLink(invoice.invoiceNo);
  if (type === "reminder") {
    return `Dear ${invoice.ownerName},\n\nReminder: Maintenance invoice ${invoice.invoiceNo} for Flat ${invoice.wing}-${invoice.flatNo} has outstanding ₹${invoice.outstanding.toLocaleString("en-IN")}.\n\nView Invoice: ${invLink}\nPay Now: ${payLink}\n\n— ${invoice.societyName}`;
  }
  if (type === "receipt") {
    return `Dear ${invoice.ownerName},\n\nPayment received for ${invoice.invoiceNo}. Thank you!\n\nInvoice: ${invLink}\n\n— ${invoice.societyName}`;
  }
  return `Dear ${invoice.ownerName},\n\nYour maintenance invoice ${invoice.invoiceNo} for ${invoice.month} is ready.\nAmount: ₹${invoice.totalAmount.toLocaleString("en-IN")}\nDue: ${invoice.dueDate}\n\nView: ${invLink}\nPay: ${payLink}\n\n— ${invoice.societyName}`;
}

export const whatsappService = {
  list(societyId: string): WhatsAppLog[] {
    return getAll()
      .filter((w) => w.societyId === societyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  preview(invoice: Invoice, type: WhatsAppLog["type"] = "invoice") {
    return {
      message: previewMessage(invoice, type),
      invoiceLink: buildInvoiceLink(invoice.invoiceNo),
      paymentLink: buildPaymentLink(invoice.invoiceNo),
      receiptLink: null as string | null,
    };
  },

  /**
   * WhatsApp delivery is not connected — preview/logging only.
   * Records Failed so the UI never pretends a message was delivered.
   */
  send(
    invoice: Invoice,
    type: WhatsAppLog["type"],
    actor: string
  ): WhatsAppLog {
    const preview = this.preview(invoice, type);
    const status: WhatsAppMessageStatus = "Failed";
    const log: WhatsAppLog = {
      id: `wa-${Date.now()}`,
      societyId: invoice.societyId,
      invoiceNo: invoice.invoiceNo,
      mobile: invoice.mobile,
      message: preview.message,
      invoiceLink: preview.invoiceLink,
      paymentLink: preview.paymentLink,
      receiptLink: null,
      status,
      type,
      createdAt: new Date().toISOString(),
    };
    saveAll([log, ...getAll()]);
    auditService.log({
      societyId: invoice.societyId,
      action: "WhatsApp Not Connected",
      entityType: "whatsapp",
      entityId: log.id,
      details: `${type} to ${invoice.mobile} blocked — provider not configured`,
      actor,
    });
    return log;
  },

  sendRemindersForUnpaid(societyId: string, actor: string, invoices: Invoice[]) {
    const unpaid = invoices.filter(
      (i) =>
        i.societyId === societyId &&
        i.status !== "Paid" &&
        i.status !== "Cancelled" &&
        i.outstanding > 0
    );
    return unpaid.map((inv) => this.send(inv, "reminder", actor));
  },
};
