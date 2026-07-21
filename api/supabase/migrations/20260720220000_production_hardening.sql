-- Production hardening (idempotent)
-- Safe to run on databases that already applied enterprise post-migration.
-- Adds missing partial indexes + check constraints if absent.

-- Primary flat lookup (billing / resident login)
CREATE INDEX IF NOT EXISTS ix_member_flats_primary
  ON member_flats (member_id, society_id)
  WHERE deleted_at IS NULL AND is_primary;

CREATE INDEX IF NOT EXISTS ix_flats_society_wing
  ON flats (society_id, wing_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_users_email_active
  ON users (email)
  WHERE deleted_at IS NULL;

-- Data integrity checks
ALTER TABLE society_settings DROP CONSTRAINT IF EXISTS chk_settings_due_day;
ALTER TABLE society_settings ADD CONSTRAINT chk_settings_due_day CHECK (due_day BETWEEN 1 AND 28);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoice_amounts;
ALTER TABLE invoices ADD CONSTRAINT chk_invoice_amounts CHECK (
  total_amount >= 0 AND paid_amount >= 0 AND outstanding >= 0 AND paid_amount <= total_amount + 0.01
);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payment_amount;
ALTER TABLE payments ADD CONSTRAINT chk_payment_amount CHECK (amount > 0);

ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS chk_line_amount;
ALTER TABLE invoice_lines ADD CONSTRAINT chk_line_amount CHECK (amount >= 0);

ALTER TABLE receipts DROP CONSTRAINT IF EXISTS chk_receipt_amounts;
ALTER TABLE receipts ADD CONSTRAINT chk_receipt_amounts CHECK (amount >= 0 AND total_paid >= 0);

-- Analyze hot tables so the planner uses partial indexes
ANALYZE members;
ANALYZE invoices;
ANALYZE payments;
ANALYZE member_flats;
