-- 12_indexes.sql
-- Hot-path indexes (use CONCURRENTLY in production windows)

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_members_society_active
  ON members (tenant_id, society_id)
  WHERE deleted_at IS NULL AND is_active;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_invoices_society_status_active
  ON invoices (society_id, status_code, due_date)
  WHERE deleted_at IS NULL AND status_code <> 'CANCELLED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_invoices_society_month_cover
  ON invoices (society_id, billing_month)
  INCLUDE (total_amount, paid_amount, outstanding, status_code)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_invoices_member_open
  ON invoices (member_id, outstanding DESC)
  WHERE deleted_at IS NULL AND outstanding > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payments_society_created
  ON payments (society_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payments_society_status
  ON payments (society_id, status_code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_payments_idempotency
  ON payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_receipts_society_month
  ON receipts (society_id, billing_month)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_visitors_society_created
  ON visitors (society_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_audit_society_created
  ON audit_logs (society_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_audit_entity
  ON audit_logs (entity_type, entity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_notifications_society_status
  ON notifications (society_id, status_code, created_at DESC);
