export const QUEUE_BILLING = 'billing';
export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_PDF = 'pdf';
export const QUEUE_REMINDERS = 'reminders';

export type GenerateMonthlyBillsJob = {
  societyId: string;
  month: string; // YYYY-MM
  actorId?: string;
};

export type PenaltyCalcJob = {
  societyId?: string;
  asOfDate?: string;
};

export type PaymentReminderJob = {
  societyId: string;
  invoiceId: string;
};

export type PdfJob =
  | { type: 'invoice'; invoiceId: string; societyId: string }
  | { type: 'receipt'; receiptId: string; societyId: string };

export type NotificationJob = {
  societyId: string;
  channel: 'EMAIL' | 'WHATSAPP';
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
};
