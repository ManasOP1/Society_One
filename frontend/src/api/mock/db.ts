/**
 * In-memory mock backend — FAKE DATA, for offline UI demos only.
 *
 * This only activates when EXPO_PUBLIC_USE_MOCK=true is explicitly set (see
 * `src/api/client.ts`). Real usage always talks to the live Nest API at
 * EXPO_PUBLIC_API_BASE_URL — this file is never used as a silent fallback.
 *
 * Mirrors the SocietyOne Next.js "backend" shape (same 3 societies, same
 * members, same seed logic for invoices, receipts, notices, events, visitors
 * and settings) purely so the mock REST contract matches the real one.
 *
 * Every query is scoped to the logged-in user's society. Residents see only
 * their own billing; a society admin sees the whole society's data.
 */

import type {
  AuthUser,
  DashboardSummary,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  PaymentMode,
  PayResponse,
  Receipt,
  SocietyEvent,
  SocietyNotice,
  SocietySettings,
  SocietyVisitor,
} from '@/api/types';

/* ------------------------------------------------------------------ */
/* Seed: societies (mirrors backend/src/data/societies.ts)             */
/* ------------------------------------------------------------------ */

interface SocietySeed {
  id: string;
  name: string;
  address: string;
  logoText: string;
}

const SOCIETIES: SocietySeed[] = [
  { id: 'green-valley', name: 'Green Valley Residency', address: 'Baner Road, Pune 411045', logoText: 'GV' },
  { id: 'sunrise-heights', name: 'Sunrise Heights', address: 'Hinjewadi Phase 1, Pune 411057', logoText: 'SH' },
  { id: 'lakeview-apartments', name: 'Lakeview Apartments', address: 'Kharadi, Pune 411014', logoText: 'LA' },
];

/** Mirrors backend settings.service defaultSettings() — identical across societies. */
function makeSettings(soc: SocietySeed): SocietySettings {
  return {
    societyId: soc.id,
    societyName: soc.name,
    address: soc.address,
    logoText: soc.logoText,
    logoDataUrl: '',
    registrationNo: 'AAF/123/2021-2022',
    panNumber: 'AAFAVS6755N',
    bankName: 'HDFC Bank',
    bankAccount: '50200012345678',
    bankIfsc: 'HDFC0001234',
    upiId: 'society@hdfcbank',
    invoicePrefix: 'INV',
    receiptPrefix: 'REC',
    maintenanceAmount: 9984,
    lateFeeAmount: 500,
    dueDay: 10,
    gstNote: 'Cheque should be drawn in favor of society only.',
    municipalDues: 7234,
    adminExpenses: 0,
    sinkingFunds: 450,
    buildingMaintenance: 800,
    parkingCharges: 1500,
    nonOccupancyCharges: 0,
    interestNote: 'Interest @ 18% p.a. will be charged for delayed payments.',
  };
}

const settingsBySociety: Record<string, SocietySettings> = Object.fromEntries(
  SOCIETIES.map((s) => [s.id, makeSettings(s)])
);

/* ------------------------------------------------------------------ */
/* Seed: members (mirrors backend/src/data/societies.ts members[])     */
/* ------------------------------------------------------------------ */

interface MemberSeed {
  id: string;
  societyId: string;
  flat: string;
  wing: string;
  owner: string;
  tenant: string;
  phone: string;
  email: string;
  parking: string;
}

const members: MemberSeed[] = [
  // Green Valley
  { id: '1', societyId: 'green-valley', flat: '203', wing: 'A', owner: 'Rahul Patil', tenant: '—', phone: '9876543210', email: 'rahul.patil@email.com', parking: 'P-12' },
  { id: '2', societyId: 'green-valley', flat: '105', wing: 'B', owner: 'Suresh Sharma', tenant: 'Priya Sharma', phone: '9876543211', email: 'priya.sharma@email.com', parking: 'P-24' },
  { id: '3', societyId: 'green-valley', flat: '412', wing: 'C', owner: 'Amit Desai', tenant: '—', phone: '9876543212', email: 'amit.desai@email.com', parking: 'P-08' },
  { id: '4', societyId: 'green-valley', flat: '118', wing: 'A', owner: 'Sneha Joshi', tenant: '—', phone: '9876543213', email: 'sneha.joshi@email.com', parking: 'P-31' },
  { id: '5', societyId: 'green-valley', flat: '301', wing: 'D', owner: 'Vikram Mehta', tenant: 'Ravi Kumar', phone: '9876543214', email: 'vikram.mehta@email.com', parking: 'P-45' },
  { id: '6', societyId: 'green-valley', flat: '205', wing: 'C', owner: 'Anita Rao', tenant: '—', phone: '9876543215', email: 'anita.rao@email.com', parking: 'P-19' },
  // Sunrise Heights
  { id: '7', societyId: 'sunrise-heights', flat: '101', wing: 'A', owner: 'Neha Kulkarni', tenant: '—', phone: '9876500001', email: 'neha.k@email.com', parking: 'P-01' },
  { id: '8', societyId: 'sunrise-heights', flat: '204', wing: 'B', owner: 'Sanjay Kale', tenant: 'Meera Iyer', phone: '9876500002', email: 'sanjay.k@email.com', parking: 'P-14' },
  { id: '9', societyId: 'sunrise-heights', flat: '310', wing: 'C', owner: 'Ramesh Jadhav', tenant: '—', phone: '9876500003', email: 'ramesh.j@email.com', parking: 'P-22' },
  // Lakeview Apartments
  { id: '10', societyId: 'lakeview-apartments', flat: '12', wing: 'East', owner: 'Pooja Gupta', tenant: '—', phone: '9876511001', email: 'pooja.g@email.com', parking: 'E-01' },
  { id: '11', societyId: 'lakeview-apartments', flat: '28', wing: 'West', owner: 'Arjun Singh', tenant: '—', phone: '9876511002', email: 'arjun.s@email.com', parking: 'W-05' },
];

/* ------------------------------------------------------------------ */
/* Seed: accounts — residents (per member) + society admins            */
/* ------------------------------------------------------------------ */

interface MockAccount extends AuthUser {
  password: string;
}

const RESIDENT_PASSWORD = 'resident123';
const ADMIN_PASSWORD = 'admin123';

const accounts: MockAccount[] = [];

// One resident login per member (email / resident123).
for (const m of members) {
  accounts.push({
    id: `u-${m.id}`,
    name: m.owner,
    email: m.email,
    phone: m.phone,
    role: 'resident',
    societyId: m.societyId,
    memberId: m.id,
    wing: m.wing,
    flat: `${m.wing}-${m.flat}`,
    password: RESIDENT_PASSWORD,
  });
}

// Society admin logins (mirrors backend adminEmail / password) — each admin
// sees the whole society's data.
const ADMIN_SEEDS = [
  { societyId: 'green-valley', name: 'Jonathan Smith', email: 'admin@greenvalley.in', phone: '9876500000' },
  { societyId: 'sunrise-heights', name: 'Priya Deshmukh', email: 'admin@sunriseheights.in', phone: '9876500010' },
  { societyId: 'lakeview-apartments', name: 'Rahul Mehta', email: 'admin@lakeview.in', phone: '9876500020' },
];

ADMIN_SEEDS.forEach((a, i) => {
  const firstMember = members.find((m) => m.societyId === a.societyId)!;
  accounts.push({
    id: `admin-${i + 1}`,
    name: a.name,
    email: a.email,
    phone: a.phone,
    role: 'admin',
    societyId: a.societyId,
    memberId: firstMember.id,
    wing: firstMember.wing,
    flat: `${firstMember.wing}-${firstMember.flat}`,
    password: ADMIN_PASSWORD,
  });
});

/* ------------------------------------------------------------------ */
/* Invoice math (mirrors backend invoice.service recalculate)          */
/* ------------------------------------------------------------------ */

let liSeq = 0;
function uid(prefix: string) {
  liSeq += 1;
  return `${prefix}-${liSeq}`;
}

function sectionSum(items: InvoiceLineItem[]): number {
  return items.reduce((s, i) => s + (i.isDeduction ? -Math.abs(i.amount) : i.amount), 0);
}

function recalculate(inv: Invoice): Invoice {
  const maintenanceSubtotal = sectionSum(inv.maintenanceItems);
  const arrearsSubtotal = sectionSum(inv.arrearsItems);
  const totalAmount = Math.max(0, maintenanceSubtotal + arrearsSubtotal);
  const outstanding = Math.max(0, totalAmount - inv.paidAmount);
  let status: InvoiceStatus = inv.status;
  if (status !== 'Cancelled') {
    if (inv.paidAmount <= 0) status = outstanding > 0 ? 'Pending' : 'Paid';
    else if (outstanding <= 0) status = 'Paid';
    else status = 'Partial';
    if (status === 'Pending' && new Date(inv.dueDate) < new Date(new Date().toDateString())) {
      status = 'Overdue';
    }
  }
  return {
    ...inv,
    maintenanceSubtotal,
    arrearsSubtotal,
    subtotal: maintenanceSubtotal,
    totalAmount,
    outstanding,
    status,
  };
}

function maintenanceItems(s: SocietySettings): InvoiceLineItem[] {
  return [
    { id: uid('li'), description: 'All Municipal Dues', amount: s.municipalDues },
    { id: uid('li'), description: 'Administration and general Expenses', amount: s.adminExpenses },
    { id: uid('li'), description: 'Sinking Funds', amount: s.sinkingFunds },
    { id: uid('li'), description: 'Periodic Building Maintenance', amount: s.buildingMaintenance },
    { id: uid('li'), description: 'Common Area Utilization / Parking', amount: s.parkingCharges },
    { id: uid('li'), description: 'Non Occupancy Charges / Miscellaneous', amount: s.nonOccupancyCharges },
  ];
}

function arrearsItems(opts: { lateFee?: number; otherArrears?: number; advance?: number }): InvoiceLineItem[] {
  return [
    { id: uid('li'), description: 'Late Payment Charges Arrears', amount: opts.lateFee ?? 0 },
    { id: uid('li'), description: 'Other Arrears', amount: opts.otherArrears ?? 0 },
    { id: uid('li'), description: 'Penalty / Interest on Arrears', amount: 0 },
    { id: uid('li'), description: 'GST on Arrears and Penalty', amount: 0 },
    { id: uid('li'), description: 'Advance (-)', amount: opts.advance ?? 0, isDeduction: true },
  ];
}

let invSeq = 0;
function buildInvoice(
  m: MemberSeed,
  month: string,
  seq: number,
  opts: { lateFee?: number; otherArrears?: number; advance?: number } = {}
): Invoice {
  invSeq += 1;
  const s = settingsBySociety[m.societyId];
  const [year, mon] = month.split('-');
  const invoiceNo = `${s.invoicePrefix}-${year}-${mon}-${String(seq).padStart(4, '0')}`;
  const issueDate = `${month}-01`;
  const dueDate = `${month}-${String(s.dueDay).padStart(2, '0')}`;
  return recalculate({
    id: `inv-${m.societyId}-${invSeq}`,
    invoiceNo,
    societyId: m.societyId,
    societyName: s.societyName,
    societyAddress: s.address,
    registrationNo: s.registrationNo,
    panNumber: s.panNumber,
    memberId: m.id,
    ownerName: m.owner,
    tenantName: m.tenant === '—' ? '' : m.tenant,
    flatNo: m.flat,
    wing: m.wing,
    areaSqft: 1200,
    ownerAddress: s.address,
    mobile: m.phone,
    email: m.email,
    month,
    year: Number(year),
    issueDate,
    dueDate,
    maintenanceItems: maintenanceItems(s),
    arrearsItems: arrearsItems(opts),
    maintenanceSubtotal: 0,
    arrearsSubtotal: 0,
    subtotal: 0,
    lateFee: opts.lateFee ?? 0,
    previousOutstanding: opts.otherArrears ?? 0,
    advance: opts.advance ?? 0,
    totalAmount: 0,
    paidAmount: 0,
    outstanding: 0,
    status: 'Pending',
    notes: s.gstNote,
    createdAt: new Date(`${issueDate}T09:00:00`).toISOString(),
    updatedAt: new Date(`${issueDate}T09:00:00`).toISOString(),
    cancelledAt: null,
  });
}

/* ------------------------------------------------------------------ */
/* Seed: invoices + receipts (mirrors backend invoice.service ensureSeed) */
/* ------------------------------------------------------------------ */

let rcptSeq = 0;
const invoices: Invoice[] = [];
const receipts: Receipt[] = [];

function makeReceipt(inv: Invoice, amount: number, mode: PaymentMode, paymentDate: string): Receipt {
  rcptSeq += 1;
  const s = settingsBySociety[inv.societyId];
  const [year, mon] = inv.month.split('-');
  return {
    id: `rcpt-${rcptSeq}`,
    receiptNo: `${s.receiptPrefix}-${year}-${mon}-${String(rcptSeq).padStart(4, '0')}`,
    invoiceNo: inv.invoiceNo,
    societyId: inv.societyId,
    societyName: s.societyName,
    ownerName: inv.ownerName,
    flatNo: inv.flatNo,
    wing: inv.wing,
    mobile: inv.mobile,
    amount,
    lateFee: inv.lateFee,
    totalPaid: amount,
    paymentDate,
    paymentMode: mode,
    utr: `UPI${String(900000000000 + rcptSeq * 7919)}`,
    bank: s.bankName,
    collectedBy: 'Society Office',
    month: inv.month,
    createdAt: new Date(`${paymentDate}T11:00:00`).toISOString(),
  };
}

function payInvoiceInPlace(inv: Invoice, amount: number, mode: PaymentMode, paymentDate: string): Receipt {
  inv.paidAmount = Math.min(inv.totalAmount, inv.paidAmount + amount);
  Object.assign(inv, recalculate(inv), { updatedAt: new Date().toISOString() });
  const receipt = makeReceipt(inv, amount, mode, paymentDate);
  receipts.unshift(receipt);
  return receipt;
}

// Mirrors backend ensureSeed: first 5 members of each society get a July-2026
// invoice — 1st fully paid, 2nd half paid, 3rd with a late fee offset by an
// advance, the rest pending (which become Overdue once past the due date).
for (const soc of SOCIETIES) {
  const socMembers = members.filter((m) => m.societyId === soc.id).slice(0, 5);
  socMembers.forEach((m, idx) => {
    const seq = idx + 1;
    const inv =
      idx === 2
        ? buildInvoice(m, '2026-07', seq, { lateFee: settingsBySociety[soc.id].lateFeeAmount, advance: 500 })
        : buildInvoice(m, '2026-07', seq);
    invoices.push(inv);
    if (idx === 0) payInvoiceInPlace(inv, inv.totalAmount, 'UPI', '2026-07-06');
    else if (idx === 1) payInvoiceInPlace(inv, Math.round(inv.totalAmount / 2), 'Net Banking', '2026-07-08');
  });
}

/* ------------------------------------------------------------------ */
/* Seed: notices, events, visitors (per society, mirrors backend seeds) */
/* ------------------------------------------------------------------ */

const today = new Date().toISOString().slice(0, 10);

const notices: SocietyNotice[] = [];
const events: SocietyEvent[] = [];
const visitors: SocietyVisitor[] = [];

for (const soc of SOCIETIES) {
  notices.push(
    {
      id: `nt-${soc.id}-1`,
      societyId: soc.id,
      title: 'Water supply schedule — July',
      body: 'Municipal water will be available from 6:00 AM to 9:00 AM and 7:00 PM to 9:00 PM. Please store water accordingly.',
      publishedAt: '2026-07-15',
      pinned: true,
      createdAt: '2026-07-15T08:00:00.000Z',
    },
    {
      id: `nt-${soc.id}-2`,
      societyId: soc.id,
      title: 'Maintenance due reminder',
      body: 'Monthly maintenance invoices for July are generated. Please clear dues by the 10th to avoid late fees.',
      publishedAt: '2026-07-05',
      pinned: false,
      createdAt: '2026-07-05T08:00:00.000Z',
    }
  );

  events.push(
    {
      id: `ev-${soc.id}-1`,
      societyId: soc.id,
      title: 'Monthly AGM',
      date: '2026-07-22',
      endDate: '2026-07-22',
      location: 'Clubhouse Hall',
      description: 'Annual general body meeting — budget review and elections.',
      budget: 15000,
      rsvpCount: 42,
      status: 'Upcoming',
      createdAt: '2026-07-01T08:00:00.000Z',
    },
    {
      id: `ev-${soc.id}-2`,
      societyId: soc.id,
      title: 'Monsoon Maintenance Drive',
      date: '2026-07-28',
      endDate: '2026-07-28',
      location: 'Common areas',
      description: 'Gutter cleaning and waterproofing inspection.',
      budget: 8000,
      rsvpCount: 12,
      status: 'Upcoming',
      createdAt: '2026-07-03T08:00:00.000Z',
    }
  );

  visitors.push(
    {
      id: `vs-${soc.id}-1`,
      societyId: soc.id,
      name: 'Delivery — Amazon',
      flat: 'A-203',
      purpose: 'Parcel delivery',
      vehicle: 'MH-12-AB-1234',
      expectedTime: 'Today, 4:00 PM',
      phone: '9876500001',
      status: 'Logged',
      createdAt: `${today}T10:30:00.000Z`,
    },
    {
      id: `vs-${soc.id}-2`,
      societyId: soc.id,
      name: 'Ramesh Kumar',
      flat: 'B-105',
      purpose: 'Guest visit',
      vehicle: '—',
      expectedTime: 'Today, 6:30 PM',
      phone: '9876500002',
      status: 'Logged',
      createdAt: `${today}T09:15:00.000Z`,
    }
  );
}

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function issueToken(kind: 'access' | 'refresh', userId: string): string {
  const ttl = kind === 'access' ? ACCESS_TTL_MS : REFRESH_TTL_MS;
  return `mock-${kind}.${userId}.${Date.now() + ttl}`;
}

/** Returns userId if valid, null otherwise. */
export function verifyToken(token: string | undefined, kind: 'access' | 'refresh'): string | null {
  if (!token) return null;
  const [prefix, userId, expiry] = token.split('.');
  if (prefix !== `mock-${kind}` || !userId || !expiry) return null;
  if (Date.now() > Number(expiry)) return null;
  if (!accounts.some((a) => a.id === userId)) return null;
  return userId;
}

/* ------------------------------------------------------------------ */
/* Query helpers used by the adapter                                   */
/* ------------------------------------------------------------------ */

function stripPassword(account: MockAccount): AuthUser {
  const { password: _pw, ...user } = account;
  return user;
}

interface Scope {
  account: MockAccount;
  societyId: string;
  isAdmin: boolean;
  memberId: string;
}

function scopeOf(userId: string): Scope | null {
  const account = accounts.find((a) => a.id === userId);
  if (!account) return null;
  return { account, societyId: account.societyId, isAdmin: account.role === 'admin', memberId: account.memberId };
}

export const mockDb = {
  societies() {
    return SOCIETIES.map((s) => ({ id: s.id, name: s.name }));
  },

  wings(societyId: string) {
    const codes = [...new Set(members.filter((m) => m.societyId === societyId).map((m) => m.wing))];
    return codes.sort().map((code) => ({ id: code, code, name: null }));
  },

  loginResident(societyId: string, wing: string, flatNo: string, password: string) {
    const member = members.find(
      (m) =>
        m.societyId === societyId &&
        m.wing.toLowerCase() === wing.trim().toLowerCase() &&
        m.flat === flatNo.trim()
    );
    if (!member) return null;
    const account = accounts.find((a) => a.memberId === member.id);
    if (!account || account.password !== password) return null;
    return {
      accessToken: issueToken('access', account.id),
      refreshToken: issueToken('refresh', account.id),
      user: stripPassword(account),
    };
  },

  login(email: string, password: string) {
    const account = accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!account || account.password !== password) return null;
    return {
      accessToken: issueToken('access', account.id),
      refreshToken: issueToken('refresh', account.id),
      user: stripPassword(account),
    };
  },

  refresh(refreshToken: string) {
    const userId = verifyToken(refreshToken, 'refresh');
    if (!userId) return null;
    return {
      accessToken: issueToken('access', userId),
      refreshToken: issueToken('refresh', userId),
    };
  },

  me(userId: string): AuthUser | null {
    const account = accounts.find((a) => a.id === userId);
    return account ? stripPassword(account) : null;
  },

  settings(userId: string): SocietySettings | null {
    const scope = scopeOf(userId);
    return scope ? { ...settingsBySociety[scope.societyId] } : null;
  },

  invoices(userId: string, filters: { status?: string; month?: string }): Invoice[] {
    const scope = scopeOf(userId);
    if (!scope) return [];
    return invoices
      .filter((i) => i.societyId === scope.societyId && (scope.isAdmin || i.memberId === scope.memberId))
      .filter((i) => !filters.status || filters.status === 'All' || i.status === filters.status)
      .filter((i) => !filters.month || i.month === filters.month)
      .map((i) => ({ ...i }))
      .sort((a, b) => b.month.localeCompare(a.month) || a.invoiceNo.localeCompare(b.invoiceNo));
  },

  invoiceByNo(userId: string, invoiceNo: string): Invoice | null {
    const scope = scopeOf(userId);
    if (!scope) return null;
    const inv = invoices.find(
      (i) =>
        i.invoiceNo === invoiceNo &&
        i.societyId === scope.societyId &&
        (scope.isAdmin || i.memberId === scope.memberId)
    );
    return inv ? { ...inv } : null;
  },

  receipts(userId: string): Receipt[] {
    const scope = scopeOf(userId);
    if (!scope) return [];
    let list = receipts.filter((r) => r.societyId === scope.societyId);
    if (!scope.isAdmin) {
      const myInvoiceNos = new Set(
        invoices.filter((i) => i.memberId === scope.memberId).map((i) => i.invoiceNo)
      );
      list = list.filter((r) => myInvoiceNos.has(r.invoiceNo));
    }
    return list.map((r) => ({ ...r })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  receiptByNo(userId: string, receiptNo: string): Receipt | null {
    const r = this.receipts(userId).find((x) => x.receiptNo === receiptNo);
    return r ?? null;
  },

  pay(userId: string, invoiceNo: string, amount: number, mode: PaymentMode): PayResponse {
    const scope = scopeOf(userId);
    const inv = invoices.find(
      (i) =>
        i.invoiceNo === invoiceNo &&
        i.societyId === scope?.societyId &&
        (scope?.isAdmin || i.memberId === scope?.memberId)
    );
    if (!inv) throw new MockApiError(404, 'Invoice not found');
    if (inv.status === 'Cancelled') throw new MockApiError(400, 'Cannot pay a cancelled invoice');
    if (inv.status === 'Paid' || inv.outstanding <= 0) throw new MockApiError(400, 'Invoice already paid');
    if (!Number.isFinite(amount) || amount <= 0) throw new MockApiError(400, 'Enter a valid amount');
    const payAmount = Math.min(amount, inv.outstanding);
    const receipt = payInvoiceInPlace(inv, payAmount, mode, new Date().toISOString().slice(0, 10));
    return { success: true, receipt: { ...receipt }, invoice: { ...inv }, utr: receipt.utr };
  },

  notices(userId: string): SocietyNotice[] {
    const scope = scopeOf(userId);
    if (!scope) return [];
    return notices
      .filter((n) => n.societyId === scope.societyId)
      .map((n) => ({ ...n }))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.publishedAt.localeCompare(a.publishedAt);
      });
  },

  noticeById(userId: string, id: string): SocietyNotice | null {
    const scope = scopeOf(userId);
    const n = notices.find((x) => x.id === id && x.societyId === scope?.societyId);
    return n ? { ...n } : null;
  },

  events(userId: string): SocietyEvent[] {
    const scope = scopeOf(userId);
    if (!scope) return [];
    return events
      .filter((e) => e.societyId === scope.societyId)
      .map((e) => ({ ...e }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  eventById(userId: string, id: string): SocietyEvent | null {
    const scope = scopeOf(userId);
    const e = events.find((x) => x.id === id && x.societyId === scope?.societyId);
    return e ? { ...e } : null;
  },

  visitors(userId: string): SocietyVisitor[] {
    const scope = scopeOf(userId);
    if (!scope) return [];
    return visitors
      .filter((v) => v.societyId === scope.societyId)
      .map((v) => ({ ...v }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  dashboard(userId: string): DashboardSummary | null {
    const scope = scopeOf(userId);
    if (!scope) return null;
    const myInvoices = this.invoices(userId, {});
    const open = myInvoices.filter((i) => i.outstanding > 0 && i.status !== 'Cancelled');
    const nextDue = [...open].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
    const myReceipts = this.receipts(userId);
    const upcoming = this.events(userId).filter((e) => e.status !== 'Completed' && e.date >= today);
    return {
      outstandingTotal: open.reduce((s, i) => s + i.outstanding, 0),
      nextDueDate: nextDue?.dueDate ?? null,
      nextDueInvoiceNo: nextDue?.invoiceNo ?? null,
      pendingInvoices: open.length,
      latestNotice: this.notices(userId)[0] ?? null,
      upcomingEvent: upcoming[0] ?? null,
      lastReceipt: myReceipts[0] ?? null,
      visitorsToday: visitors.filter((v) => v.societyId === scope.societyId && v.createdAt.startsWith(today)).length,
    };
  },
};

export class MockApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
