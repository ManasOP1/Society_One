/** Shared domain types — swap service implementations later; keep these stable. */

export type InvoiceStatus =
  | "Pending"
  | "Partial"
  | "Paid"
  | "Cancelled"
  | "Overdue";

export type PaymentMode =
  | "UPI"
  | "Net Banking"
  | "Credit Card"
  | "Debit Card"
  | "Cash"
  | "Cheque"
  | "Wallet"
  | "Other";

export type WhatsAppMessageStatus = "Pending" | "Sent" | "Delivered" | "Failed";

export interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  /** Advance rows are stored as positive amounts and subtracted in totals */
  isDeduction?: boolean;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  societyId: string;
  societyName: string;
  societyAddress: string;
  registrationNo: string;
  panNumber: string;
  memberId: string;
  ownerName: string;
  tenantName: string;
  flatNo: string;
  wing: string;
  areaSqft: number;
  ownerAddress: string;
  mobile: string;
  email: string;
  month: string; // YYYY-MM
  year: number;
  issueDate: string;
  dueDate: string;
  /** @deprecated use maintenanceItems — kept for older localStorage rows */
  lineItems: InvoiceLineItem[];
  maintenanceItems: InvoiceLineItem[];
  arrearsItems: InvoiceLineItem[];
  maintenanceSubtotal: number;
  arrearsSubtotal: number;
  subtotal: number;
  lateFee: number;
  previousOutstanding: number;
  advance: number;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  status: InvoiceStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  invoiceNo: string;
  societyId: string;
  societyName: string;
  ownerName: string;
  flatNo: string;
  wing: string;
  mobile: string;
  amount: number;
  lateFee: number;
  totalPaid: number;
  paymentDate: string;
  paymentMode: PaymentMode;
  utr: string;
  bank: string;
  collectedBy: string;
  month: string;
  createdAt: string;
}

export interface SimulatedPaymentResult {
  success: boolean;
  receipt: Receipt;
  invoice: Invoice;
  utr: string;
}

export interface WhatsAppLog {
  id: string;
  societyId: string;
  invoiceNo: string;
  mobile: string;
  message: string;
  invoiceLink: string;
  paymentLink: string;
  receiptLink: string | null;
  status: WhatsAppMessageStatus;
  type: "invoice" | "reminder" | "receipt";
  createdAt: string;
}

export interface AuditLog {
  id: string;
  societyId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  actor: string;
  createdAt: string;
}

export interface SocietySettings {
  societyId: string;
  societyName: string;
  address: string;
  logoText: string;
  /** Society-specific logo stored as a compressed data URL (local demo only). */
  logoDataUrl: string;
  registrationNo: string;
  panNumber: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  upiId: string;
  invoicePrefix: string;
  receiptPrefix: string;
  maintenanceAmount: number;
  maintenanceAmount1Bhk: number;
  maintenanceAmount2Bhk: number;
  maintenanceAmount3Bhk: number;
  lateFeeAmount: number;
  dueDay: number;
  gstNote: string;
  /** Default maintenance bill split (Housing Society format) */
  municipalDues: number;
  adminExpenses: number;
  sinkingFunds: number;
  buildingMaintenance: number;
  parkingCharges: number;
  nonOccupancyCharges: number;
  interestNote: string;
}

export interface Expense {
  id: string;
  societyId: string;
  category: string;
  vendor: string;
  amount: number;
  expenseDate: string;
  billName: string;
  remarks: string;
  createdAt: string;
}
