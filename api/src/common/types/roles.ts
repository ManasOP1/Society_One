/**
 * Enterprise schema has no Prisma `Role` enum — roles live in `user_role_assignments`
 * (roleCode column, FK to lk_role). This union replaces the old generated enum
 * everywhere in application code (guards, decorators, JWT payloads, DTOs).
 */
export const ROLE_VALUES = [
  'SUPER_ADMIN',
  'SOCIETY_ADMIN',
  'COMMITTEE_MEMBER',
  'SECURITY_GUARD',
  'RESIDENT',
] as const;

export type Role = (typeof ROLE_VALUES)[number];

export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SOCIETY_ADMIN: 'SOCIETY_ADMIN',
  COMMITTEE_MEMBER: 'COMMITTEE_MEMBER',
  SECURITY_GUARD: 'SECURITY_GUARD',
  RESIDENT: 'RESIDENT',
} as const satisfies Record<Role, Role>;

export function isRole(value: string): value is Role {
  return (ROLE_VALUES as readonly string[]).includes(value);
}

/** Priority order used to pick a "primary" role when a user has multiple assignments. */
const ROLE_PRIORITY: Role[] = [
  'SUPER_ADMIN',
  'SOCIETY_ADMIN',
  'COMMITTEE_MEMBER',
  'SECURITY_GUARD',
  'RESIDENT',
];

export function pickPrimaryRole(roleCodes: string[]): Role {
  const roles = roleCodes.filter(isRole);
  for (const candidate of ROLE_PRIORITY) {
    if (roles.includes(candidate)) return candidate;
  }
  return 'RESIDENT';
}

// ─── Status code unions (enterprise schema uses lookup-table string codes) ───

export const SocietyStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type SocietyStatus = (typeof SocietyStatus)[keyof typeof SocietyStatus];

// Codes below mirror the seeded rows in supabase/migrations/enterprise/02_lookup_tables.sql

export const InvoiceStatus = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMode = {
  UPI: 'UPI',
  NET_BANKING: 'NET_BANKING',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  CASH: 'CASH',
  CHEQUE: 'CHEQUE',
  WALLET: 'WALLET',
  RAZORPAY: 'RAZORPAY',
  OTHER: 'OTHER',
} as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

export const VisitorStatus = {
  LOGGED: 'LOGGED',
  EXPECTED: 'EXPECTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CHECKED_OUT: 'CHECKED_OUT',
} as const;
export type VisitorStatus = (typeof VisitorStatus)[keyof typeof VisitorStatus];

export const ComplaintStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const;
export type ComplaintStatus = (typeof ComplaintStatus)[keyof typeof ComplaintStatus];

export const ComplaintPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type ComplaintPriority = (typeof ComplaintPriority)[keyof typeof ComplaintPriority];

export const NotificationChannel = {
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  PUSH: 'PUSH',
  SMS: 'SMS',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const DocumentType = {
  INVOICE_PDF: 'INVOICE_PDF',
  RECEIPT_PDF: 'RECEIPT_PDF',
  SOCIETY_LOGO: 'SOCIETY_LOGO',
  EXPENSE_BILL: 'EXPENSE_BILL',
  MEMBER_DOC: 'MEMBER_DOC',
  OTHER: 'OTHER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const EventStatus = {
  UPCOMING: 'UPCOMING',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];
