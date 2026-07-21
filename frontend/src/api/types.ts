/**
 * Domain types — mirror of the SocietyOne backend (`backend/src/types/index.ts`).
 * Keep in sync with the server; these shape every API response the app consumes.
 */

export type InvoiceStatus = 'Pending' | 'Partial' | 'Paid' | 'Cancelled' | 'Overdue';

export type PaymentMode =
  | 'UPI'
  | 'Net Banking'
  | 'Credit Card'
  | 'Debit Card'
  | 'Cash'
  | 'Cheque'
  | 'Wallet'
  | 'Other';

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

export interface SocietySettings {
  societyId: string;
  societyName: string;
  address: string;
  logoText: string;
  /** Society logo as a data URL (uploaded by the society admin) */
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
  lateFeeAmount: number;
  dueDay: number;
  gstNote: string;
  municipalDues: number;
  adminExpenses: number;
  sinkingFunds: number;
  buildingMaintenance: number;
  parkingCharges: number;
  nonOccupancyCharges: number;
  interestNote: string;
}

export interface SocietyNotice {
  id: string;
  societyId: string;
  title: string;
  body: string;
  publishedAt: string;
  pinned: boolean;
  createdAt: string;
}

export type EventStatus = 'Upcoming' | 'Ongoing' | 'Completed';

export interface SocietyEvent {
  id: string;
  societyId: string;
  title: string;
  date: string;
  endDate: string;
  location: string;
  description: string;
  budget: number;
  rsvpCount: number;
  status: EventStatus;
  createdAt: string;
}

export interface SocietyVisitor {
  id: string;
  societyId: string;
  name: string;
  flat: string;
  purpose: string;
  vehicle: string;
  expectedTime: string;
  phone: string;
  status: 'Logged';
  createdAt: string;
}

/* ---- Auth / app-level DTOs ---- */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'resident' | 'admin';
  societyId: string;
  memberId: string;
  wing: string;
  flat: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}

export interface DashboardSummary {
  outstandingTotal: number;
  nextDueDate: string | null;
  nextDueInvoiceNo: string | null;
  pendingInvoices: number;
  latestNotice: SocietyNotice | null;
  upcomingEvent: SocietyEvent | null;
  lastReceipt: Receipt | null;
  visitorsToday: number;
}

export interface PayRequest {
  invoiceNo: string;
  amount: number;
  mode: PaymentMode;
}

export interface PayResponse {
  success: boolean;
  receipt: Receipt;
  invoice: Invoice;
  utr: string;
}

export interface InvoiceFilters {
  status?: InvoiceStatus | 'All';
  month?: string; // YYYY-MM
}
