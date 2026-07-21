# Query Optimization Strategy

## Access patterns (design to the query)

| Use case | Path | Target |
| --- | --- | --- |
| Resident dashboard | `mv_dashboard_summary` + Redis | < 20 ms |
| Invoice list (month/status) | Covering index on invoices | Index-only |
| Pay invoice | Select invoice FOR UPDATE → payment insert | Serializable or row lock |
| Webhook settle | Idempotent webhook unique + single TX | < 100 ms |
| Outstanding report | `mv_outstanding_report` or `rpt_society_monthly` | No live SUM |
| Guard visitor feed | Partial index + Realtime | Cursor pagination |

## Rules

1. **Always predicate** `tenant_id` + `society_id` (+ `deleted_at IS NULL`).
2. **Residents:** always `member_id = :memberId` — never society-wide invoice scans in app code.
3. **No N+1:** use Prisma `include` sparingly; prefer views for read models.
4. **Pagination:** keyset `(created_at, id)` not `OFFSET` past page 20.
5. **Money writes:** one transaction; lock invoice row `FOR UPDATE`.
6. **Reports:** never aggregate millions online — use matviews / `rpt_*`.
7. **EXPLAIN (ANALYZE, BUFFERS)** on every new endpoint before merge.

## Example: settle payment

```sql
BEGIN;
SELECT id, outstanding, paid_amount, row_version
FROM invoices
WHERE id = $1 AND society_id = $2 AND deleted_at IS NULL
FOR UPDATE;

-- insert payment_transactions, update payment, update invoice, insert receipt
COMMIT;
```

## Example: keyset invoice list

```sql
SELECT id, invoice_no, outstanding, status_code, due_date
FROM invoices
WHERE society_id = $1
  AND deleted_at IS NULL
  AND status_code = ANY($2)
  AND (due_date, id) < ($3, $4)  -- cursor
ORDER BY due_date DESC, id DESC
LIMIT 50;
```

## Connection pooling

- Nest runtime → **Session pooler** (Supabase port 5432 pooler).
- Migrations / `REFRESH MATERIALIZED VIEW` → **Direct** or session with longer timeout.
- Pool size ≈ `(cores * 2) + spindle` per instance; prefer fewer fat instances.

## Prisma notes

- Use interactive transactions for settlement.
- Avoid `$queryRaw` without society filters.
- Soft-delete: Prisma client extension auto-adds `deleted_at: null`.
