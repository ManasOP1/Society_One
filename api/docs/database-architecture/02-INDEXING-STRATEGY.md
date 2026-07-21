# Indexing Strategy

## Goals

- Sub-10ms tenant-scoped lookups at p95 for hot paths
- Support millions of invoices/payments without sequential scans
- Prefer **composite leading columns** matching `WHERE tenant_id = ? AND society_id = ?`

## Patterns

| Pattern | When | Example |
| --- | --- | --- |
| **Composite B-tree** | Equality filters left→right | `(tenant_id, society_id, status_code)` |
| **Covering (INCLUDE)** | Index-only scans | `(society_id, billing_month) INCLUDE (total_amount, paid_amount, outstanding)` |
| **Partial** | Hot subset | `WHERE deleted_at IS NULL AND status_code <> 'CANCELLED'` |
| **Unique** | Business keys | `(society_id, invoice_no)`, `(provider, event_id)` |
| **BRIN** | Append-only time series on partitions | `created_at` on `payment_transactions` |
| **GIN/trgm** | Search | `owner_name gin_trgm_ops`, email |

## Hot-path indexes (must-have)

```sql
-- Members
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_members_society_active
  ON members (tenant_id, society_id)
  WHERE deleted_at IS NULL AND is_active;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_members_society_email_trgm
  ON members USING gin (email gin_trgm_ops);

-- Invoices
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

-- Payments
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payments_society_created
  ON payments (society_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payments_society_status
  ON payments (society_id, status_code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_payments_idempotency
  ON payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Receipts
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_receipts_society_month
  ON receipts (society_id, billing_month)
  WHERE deleted_at IS NULL;

-- Visitors (guard realtime)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_visitors_society_created
  ON visitors (society_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Audit (partition-local)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_audit_society_created
  ON audit_logs (society_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_audit_entity
  ON audit_logs (entity_type, entity_id);
```

## Anti-patterns

- Indexing only `society_id` when queries always filter `tenant_id + society_id` (add both).
- Low-selectivity indexes alone (`is_active` boolean).
- Duplicate indexes overlapping Prisma `@@index` — consolidate in one migration.
- Updating indexed columns on hot rows frequently (prefer append-only transactions).

## Maintenance

- `pg_stat_user_indexes` weekly: drop unused.
- `REINDEX CONCURRENTLY` after large bulk loads.
- Autovacuum tune for `payments` / `audit_logs` partitions (lower `scale_factor`).
