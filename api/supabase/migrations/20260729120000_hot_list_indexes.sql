-- Hot-path composites matching real Nest list ORDER BY + soft-delete filters.
-- Methods: #2, #3, #10, #28 — expected: list latency O(log n + page) vs filter-sort.

CREATE INDEX IF NOT EXISTS ix_receipts_society_created
  ON receipts (society_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_invoices_society_month_created
  ON invoices (society_id, billing_month DESC, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_members_society_owner
  ON members (society_id, owner_name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_notices_society_pinned_published
  ON notices (society_id, pinned DESC, published_at DESC)
  WHERE deleted_at IS NULL;

ANALYZE receipts;
ANALYZE invoices;
ANALYZE members;
ANALYZE notices;
