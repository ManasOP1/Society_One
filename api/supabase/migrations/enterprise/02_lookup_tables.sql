-- 02_lookup_tables.sql
-- Extensible code tables (prefer over PG ENUM for zero-downtime adds)

CREATE TABLE IF NOT EXISTS lk_role (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lk_society_status (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_invoice_status (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_payment_status (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_payment_mode (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_visitor_status (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_complaint_status (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_complaint_priority (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_notification_channel (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_notification_status (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_document_type (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS lk_event_status (
  code varchar(32) PRIMARY KEY,
  label text NOT NULL
);

INSERT INTO lk_role (code, label, sort_order) VALUES
  ('SUPER_ADMIN', 'Super Admin', 1),
  ('SOCIETY_ADMIN', 'Society Admin', 2),
  ('COMMITTEE_MEMBER', 'Committee Member', 3),
  ('SECURITY_GUARD', 'Security Guard', 4),
  ('RESIDENT', 'Resident', 5)
ON CONFLICT DO NOTHING;

INSERT INTO lk_society_status (code, label) VALUES
  ('ACTIVE', 'Active'), ('INACTIVE', 'Inactive'), ('SUSPENDED', 'Suspended')
ON CONFLICT DO NOTHING;

INSERT INTO lk_invoice_status (code, label) VALUES
  ('PENDING', 'Pending'), ('PARTIAL', 'Partial'), ('PAID', 'Paid'),
  ('OVERDUE', 'Overdue'), ('CANCELLED', 'Cancelled')
ON CONFLICT DO NOTHING;

INSERT INTO lk_payment_status (code, label) VALUES
  ('CREATED', 'Created'), ('PENDING', 'Pending'), ('AUTHORIZED', 'Authorized'),
  ('CAPTURED', 'Captured'), ('FAILED', 'Failed'), ('REFUNDED', 'Refunded')
ON CONFLICT DO NOTHING;

INSERT INTO lk_payment_mode (code, label) VALUES
  ('UPI', 'UPI'), ('NET_BANKING', 'Net Banking'), ('CREDIT_CARD', 'Credit Card'),
  ('DEBIT_CARD', 'Debit Card'), ('CASH', 'Cash'), ('CHEQUE', 'Cheque'),
  ('WALLET', 'Wallet'), ('RAZORPAY', 'Razorpay'), ('OTHER', 'Other')
ON CONFLICT DO NOTHING;

INSERT INTO lk_visitor_status (code, label) VALUES
  ('LOGGED', 'Logged'), ('EXPECTED', 'Expected'), ('APPROVED', 'Approved'),
  ('REJECTED', 'Rejected'), ('CHECKED_OUT', 'Checked Out')
ON CONFLICT DO NOTHING;

INSERT INTO lk_complaint_status (code, label) VALUES
  ('OPEN', 'Open'), ('IN_PROGRESS', 'In Progress'),
  ('RESOLVED', 'Resolved'), ('REJECTED', 'Rejected')
ON CONFLICT DO NOTHING;

INSERT INTO lk_complaint_priority (code, label) VALUES
  ('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')
ON CONFLICT DO NOTHING;

INSERT INTO lk_notification_channel (code, label) VALUES
  ('EMAIL', 'Email'), ('WHATSAPP', 'WhatsApp'), ('PUSH', 'Push'), ('SMS', 'SMS')
ON CONFLICT DO NOTHING;

INSERT INTO lk_notification_status (code, label) VALUES
  ('QUEUED', 'Queued'), ('SENT', 'Sent'), ('DELIVERED', 'Delivered'), ('FAILED', 'Failed')
ON CONFLICT DO NOTHING;

INSERT INTO lk_document_type (code, label) VALUES
  ('INVOICE_PDF', 'Invoice PDF'), ('RECEIPT_PDF', 'Receipt PDF'),
  ('SOCIETY_LOGO', 'Society Logo'), ('EXPENSE_BILL', 'Expense Bill'),
  ('MEMBER_DOC', 'Member Document'), ('OTHER', 'Other')
ON CONFLICT DO NOTHING;

INSERT INTO lk_event_status (code, label) VALUES
  ('UPCOMING', 'Upcoming'), ('ONGOING', 'Ongoing'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled')
ON CONFLICT DO NOTHING;
