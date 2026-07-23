/**
 * Maps raw Nest API responses (enterprise Postgres schema, uppercase status
 * codes, Prisma field names) onto the frontend's domain types. This is the
 * only place that needs to change if the API's serialization shape shifts.
 */

import type {
  AuthUser,
  DashboardSummary,
  EventStatus,
  Invoice,
  InvoiceStatus,
  PaymentMode,
  Receipt,
  SocietyEvent,
  SocietyNotice,
  SocietySettings,
  SocietyVisitor,
} from '@/api/types';

/* ---------------------------------------------------------------------- */
/* Enum / status maps                                                      */
/* ---------------------------------------------------------------------- */

const ROLE_MAP: Record<string, AuthUser['role']> = {
  SOCIETY_ADMIN: 'admin',
  COMMITTEE_MEMBER: 'admin',
  SUPER_ADMIN: 'admin',
  SECURITY_GUARD: 'admin',
  RESIDENT: 'resident',
};

const INVOICE_STATUS_MAP: Record<string, InvoiceStatus> = {
  PENDING: 'Pending',
  PARTIAL: 'Partial',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

const EVENT_STATUS_MAP: Record<string, EventStatus> = {
  UPCOMING: 'Upcoming',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  CANCELLED: 'Completed',
};

const PAYMENT_MODE_MAP: Record<string, PaymentMode> = {
  UPI: 'UPI',
  NET_BANKING: 'Net Banking',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  WALLET: 'Wallet',
  RAZORPAY: 'UPI',
  OTHER: 'Other',
};

export function mapRole(code: string | null | undefined): AuthUser['role'] {
  return ROLE_MAP[String(code)] ?? 'resident';
}

export function mapInvoiceStatus(code: string | null | undefined): InvoiceStatus {
  return INVOICE_STATUS_MAP[String(code)] ?? 'Pending';
}

export function mapEventStatus(code: string | null | undefined): EventStatus {
  return EVENT_STATUS_MAP[String(code)] ?? 'Upcoming';
}

export function mapPaymentMode(code: string | null | undefined): PaymentMode {
  return PAYMENT_MODE_MAP[String(code)] ?? 'Other';
}

/* ---------------------------------------------------------------------- */
/* Shared helpers                                                          */
/* ---------------------------------------------------------------------- */

function str(v: unknown, fallback = ''): string {
  return v === null || v === undefined ? fallback : String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toDateOnly(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/* ---------------------------------------------------------------------- */
/* Auth                                                                     */
/* ---------------------------------------------------------------------- */

/** Raw shape returned by Nest for the logged-in user (login/me/refresh). */
export interface ApiAuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId?: string | null;
  societyId: string | null;
  memberId: string | null;
  phone?: string | null;
  wing?: string | null;
  flatNo?: string | null;
}

export interface ApiLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: ApiAuthUser;
}

export function mapAuthUser(u: ApiAuthUser): AuthUser {
  return {
    id: u.id,
    name: str(u.name),
    email: str(u.email),
    phone: str(u.phone),
    role: mapRole(u.role),
    societyId: str(u.societyId),
    memberId: str(u.memberId),
    wing: str(u.wing),
    flat: str(u.flatNo),
  };
}

export function mapLoginResponse(r: ApiLoginResponse) {
  return {
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    user: mapAuthUser(r.user),
  };
}

/* ---------------------------------------------------------------------- */
/* Society settings                                                        */
/* ---------------------------------------------------------------------- */

export function mapSettings(s: Record<string, unknown>): SocietySettings {
  return {
    societyId: str(s.societyId),
    societyName: str(s.societyName, 'Society'),
    address: str(s.address),
    logoText: str(s.logoText, 'LOGO'),
    logoDataUrl: str(s.logoDataUrl ?? s.logoUrl),
    registrationNo: str(s.registrationNo),
    panNumber: str(s.panNumber),
    bankName: str(s.bankName),
    bankAccount: str(s.bankAccount),
    bankIfsc: str(s.bankIfsc),
    upiId: str(s.upiId),
    invoicePrefix: str(s.invoicePrefix, 'INV'),
    receiptPrefix: str(s.receiptPrefix, 'REC'),
    maintenanceAmount: num(s.maintenanceAmount),
    lateFeeAmount: num(s.lateFeeAmount),
    dueDay: num(s.dueDay, 10),
    gstNote: str(s.gstNote),
    municipalDues: num(s.municipalDues),
    adminExpenses: num(s.adminExpenses),
    sinkingFunds: num(s.sinkingFunds),
    buildingMaintenance: num(s.buildingMaintenance),
    parkingCharges: num(s.parkingCharges),
    nonOccupancyCharges: num(s.nonOccupancyCharges),
    interestNote: str(s.interestNote),
  };
}

/* ---------------------------------------------------------------------- */
/* Invoices / receipts                                                      */
/* ---------------------------------------------------------------------- */

export function mapInvoice(row: Record<string, unknown>): Invoice {
  const lineItems = Array.isArray(row.lineItems)
    ? (row.lineItems as Record<string, unknown>[]).map((l, idx) => ({
        id: str(l.id, `li-${idx}`),
        description: str(l.description),
        amount: num(l.amount),
        isDeduction: !!l.isDeduction,
      }))
    : [];
  const arrearsRe = /arrears|advance|penalty|gst|interest/i;
  const maintenanceItems = lineItems.filter((l) => !arrearsRe.test(l.description));
  const arrearsItems = lineItems.filter((l) => arrearsRe.test(l.description));

  return {
    id: str(row.id),
    invoiceNo: str(row.invoiceNo),
    societyId: str(row.societyId),
    societyName: str(row.societyName),
    societyAddress: str(row.societyAddress),
    registrationNo: str(row.registrationNo),
    panNumber: str(row.panNumber),
    memberId: str(row.memberId),
    ownerName: str((row.member as Record<string, unknown> | undefined)?.ownerName ?? row.ownerName),
    tenantName: str(row.tenantName),
    flatNo: str((row.flat as Record<string, unknown> | undefined)?.flatNo ?? row.flatNo),
    wing: str(
      ((row.flat as Record<string, unknown> | undefined)?.wing as Record<string, unknown> | undefined)?.code ??
        row.wing
    ),
    areaSqft: num(row.areaSqft ?? (row.flat as Record<string, unknown> | undefined)?.areaSqft),
    ownerAddress: str(row.ownerAddress),
    mobile: str((row.member as Record<string, unknown> | undefined)?.phone ?? row.mobile),
    email: str((row.member as Record<string, unknown> | undefined)?.email ?? row.email),
    month: str(row.month ?? row.billingMonth),
    year: num(row.year),
    issueDate: toDateOnly(row.issueDate),
    dueDate: toDateOnly(row.dueDate),
    maintenanceItems,
    arrearsItems,
    maintenanceSubtotal: num(row.maintenanceSubtotal),
    arrearsSubtotal: num(row.arrearsSubtotal),
    subtotal: num(row.maintenanceSubtotal),
    lateFee: num(row.lateFee),
    previousOutstanding: num(row.previousOutstanding),
    advance: num(row.advance),
    totalAmount: num(row.totalAmount),
    paidAmount: num(row.paidAmount),
    outstanding: num(row.outstanding),
    status: mapInvoiceStatus(str(row.status ?? row.statusCode)),
    notes: str(row.notes),
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
    cancelledAt: row.cancelledAt ? str(row.cancelledAt) : null,
  };
}

export function mapReceipt(row: Record<string, unknown>): Receipt {
  const invoice = row.invoice as Record<string, unknown> | undefined;
  const flat = (invoice?.flat ?? row.flat) as Record<string, unknown> | undefined;
  const wingObj = flat?.wing as Record<string, unknown> | undefined;
  return {
    id: str(row.id),
    receiptNo: str(row.receiptNo),
    invoiceNo: str(invoice?.invoiceNo ?? row.invoiceNo),
    societyId: str(row.societyId),
    societyName: str(row.societyName),
    ownerName: str((row.member as Record<string, unknown> | undefined)?.ownerName ?? row.ownerName),
    flatNo: str(row.flatNo ?? flat?.flatNo),
    wing: str(row.wing ?? wingObj?.code),
    mobile: str(row.mobile),
    amount: num(row.amount),
    lateFee: num(row.lateFee),
    totalPaid: num(row.totalPaid),
    paymentDate: toDateOnly(row.paymentDate ?? row.createdAt),
    paymentMode: mapPaymentMode(str(row.paymentMode ?? row.mode ?? row.modeCode)),
    utr: str(row.utr),
    bank: str(row.bank),
    collectedBy: str(row.collectedBy),
    month: str(row.month ?? row.billingMonth),
    createdAt: str(row.createdAt),
  };
}

/* ---------------------------------------------------------------------- */
/* Notices / events / visitors                                             */
/* ---------------------------------------------------------------------- */

export function mapNotice(row: Record<string, unknown>): SocietyNotice {
  return {
    id: str(row.id),
    societyId: str(row.societyId),
    title: str(row.title),
    body: str(row.body),
    publishedAt: toDateOnly(row.publishedAt ?? row.createdAt),
    pinned: !!row.pinned,
    createdAt: str(row.createdAt),
  };
}

export function mapEvent(row: Record<string, unknown>): SocietyEvent {
  return {
    id: str(row.id),
    societyId: str(row.societyId),
    title: str(row.title),
    date: toDateOnly(row.date ?? row.eventDate),
    endDate: toDateOnly(row.endDate ?? row.date ?? row.eventDate),
    location: str(row.location),
    description: str(row.description),
    budget: num(row.budget),
    rsvpCount: num(row.rsvpCount),
    status: mapEventStatus(str(row.status ?? row.statusCode)),
    createdAt: str(row.createdAt),
  };
}

export function mapVisitor(row: Record<string, unknown>): SocietyVisitor {
  return {
    id: str(row.id),
    societyId: str(row.societyId),
    name: str(row.name),
    flat: str(row.flat ?? row.flatLabel),
    purpose: str(row.purpose),
    vehicle: str(row.vehicle),
    expectedTime: str(row.expectedTime),
    phone: str(row.phone),
    status: 'Logged',
    createdAt: str(row.createdAt),
  };
}

/* ---------------------------------------------------------------------- */
/* Dashboard                                                                */
/* ---------------------------------------------------------------------- */

export function mapDashboard(row: Record<string, unknown>): DashboardSummary {
  return {
    outstandingTotal: num(row.outstandingTotal),
    nextDueDate: row.nextDueDate ? toDateOnly(row.nextDueDate) : null,
    nextDueInvoiceNo: row.nextDueInvoiceNo ? str(row.nextDueInvoiceNo) : null,
    pendingInvoices: num(row.pendingInvoices),
    latestNotice: row.latestNotice ? mapNotice(row.latestNotice as Record<string, unknown>) : null,
    upcomingEvent: row.upcomingEvent ? mapEvent(row.upcomingEvent as Record<string, unknown>) : null,
    lastReceipt: row.lastReceipt ? mapReceipt(row.lastReceipt as Record<string, unknown>) : null,
    visitorsToday: num(row.visitorsToday),
  };
}
