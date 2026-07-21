# SocietyOne — Enterprise PostgreSQL Architecture

**Version:** 2.0.0-enterprise  
**Date:** 20 July 2026  
**Audience:** Platform engineers, DBAs, security  
**Stack:** NestJS · Prisma · Supabase Postgres · BullMQ · Redis · Razorpay  

Interactive summary: open the IDE canvas **societyone-db-architecture** beside chat.

---

## 1. Design principles (banking-grade)

| Principle | Implementation |
| --- | --- |
| **Defense in depth** | App filters + RLS + no cross-tenant FKs without tenant_id |
| **Immutable money** | `payment_transactions` append-only; never UPDATE amount/status history — new rows |
| **Idempotency** | Unique `idempotency_key`, Razorpay ids, webhook `event_id` |
| **Soft delete** | `deleted_at` / `deleted_by_id`; financial rows use status, not hard delete |
| **UUID PKs** | `uuid` default `gen_random_uuid()` (prefer UUIDv7 when extension available) |
| **Dual tenancy keys** | `tenant_id` + `society_id` on every society-scoped row |
| **RESTRICT money FKs** | No `ON DELETE CASCADE` from invoices/payments/receipts |
| **Hot path denorm** | Reporting tables + matviews; OLTP stays normalized |
| **Partition growth** | Monthly RANGE on ledgers & observability |
| **Least privilege** | DB roles: `app_runtime`, `app_migrator`, `readonly_analytics` |

### Tenancy model

```text
Platform (SUPER_ADMIN)
  └── Tenant (management company / SaaS customer)
        └── Society (building)
              └── Wing → Flat → Member (resident)
                    └── Invoice → Payment → Receipt
```

- **tenant_id** — SaaS customer boundary (billing account, feature flags).
- **society_id** — Property boundary (RLS for residents/admins).
- A tenant may own many societies; a society belongs to exactly one tenant.
- For single-society self-serve, create one tenant per society at onboarding.

### Standard column set (every business table)

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id       uuid NOT NULL,          -- except pure platform tables
society_id      uuid,                    -- NOT NULL for society-scoped
created_at      timestamptz NOT NULL DEFAULT now(),
updated_at      timestamptz NOT NULL DEFAULT now(),
deleted_at      timestamptz,
created_by_id   uuid,
updated_by_id   uuid,
deleted_by_id   uuid,
row_version     integer NOT NULL DEFAULT 1  -- optimistic concurrency
```

Platform-only tables (`tenants`, global `payment_webhooks` pre-attribution) document exceptions.

---

## 2. Package contents

| Path | Contents |
| --- | --- |
| `00-OVERVIEW.md` | This file |
| `01-ER-DIAGRAM.md` | Mermaid ER + domain map |
| `02-INDEXING-STRATEGY.md` | B-tree, composite, covering, partial, BRIN |
| `03-QUERY-OPTIMIZATION.md` | Access patterns & EXPLAIN guidance |
| `04-REDIS-CACHING.md` | Cache keys, TTLs, invalidation |
| `05-BACKUP-DR.md` | RPO/RTO, PITR, failover |
| `06-STORAGE-HIERARCHY.md` | Supabase Storage layout |
| `07-MIGRATION-ORDER.md` | Ordered apply list |
| `../prisma/schema.enterprise.prisma` | Prisma logical model |
| `../supabase/migrations/enterprise/*.sql` | DDL, partitions, RLS, functions |

---

## 3. Logical domains

### 3.1 Lookups (enum tables)

Prefer tables over Postgres ENUMs for evolvability (add rows without migrate locks):

- `lk_role`, `lk_society_status`, `lk_invoice_status`, `lk_payment_status`
- `lk_payment_mode`, `lk_visitor_status`, `lk_complaint_status`, `lk_complaint_priority`
- `lk_notification_channel`, `lk_notification_status`, `lk_document_type`, `lk_event_status`

Codes are stable strings (`RESIDENT`); display labels localized in app.

### 3.2 Identity & RBAC

- `tenants`, `societies`, `users`
- `user_role_assignments` (user may be RESIDENT + COMMITTEE_MEMBER)
- `refresh_tokens` (hashed), `user_sessions` (optional device metadata)

### 3.3 Property

- `wings` (lookup per society), `flats`, `members`
- `member_flats` (owner vs tenant occupancy history)

### 3.4 Billing

- `charge_catalog` — reusable fee lines per society
- `society_settings` — bank/UPI/prefixes/due day
- `number_sequences` — atomic invoice/receipt counters per society+year
- `invoices` — header with **generated** `outstanding = total_amount - paid_amount`
- `invoice_lines` — normalized line items (no JSON blobs for money)

### 3.5 Money (ledger)

| Table | Mutability | Partition |
| --- | --- | --- |
| `payments` | Status transitions only | RANGE(created_at) |
| `payment_transactions` | **Insert only** | RANGE(created_at) |
| `payment_webhooks` | Insert + processed_at | RANGE(received_at) |
| `receipts` | Insert; PDF URL update | — (or yearly) |

Settlement flow (Razorpay):

1. Insert `payments` CREATED + Razorpay order  
2. Webhook → insert `payment_webhooks`  
3. Verify HMAC → insert `payment_transactions` CAPTURED  
4. Update payment status + invoice paid/outstanding  
5. Insert `receipts` (trigger or service)  
6. Enqueue PDF + notification  

### 3.6 Operations

`notices`, `society_events`, `visitors`, `complaints`, `documents`, `expenses`

### 3.7 Observability (partitioned)

`audit_logs`, `activity_logs`, `notifications`

### 3.8 Reporting

**Materialized views:** `mv_dashboard_summary`, `mv_monthly_collection`, `mv_outstanding_report`, `mv_resident_summary`, `mv_payment_summary`  

**Views:** `v_invoice_details`, `v_resident_details`, `v_payment_details`  

**Tables:** `rpt_society_daily`, `rpt_society_monthly` — BullMQ refresh, not live joins at request time.

---

## 4. Cascading & checks

| Parent → Child | Rule |
| --- | --- |
| tenant → society | RESTRICT (archive tenant first) |
| society → flat/member | RESTRICT if financial history; soft-delete society |
| invoice → payment/receipt | **RESTRICT** |
| payment → receipt | RESTRICT |
| user → refresh_token | CASCADE |
| member → complaint | SET NULL or RESTRICT + soft delete |

**Checks (examples):**

```sql
CHECK (amount > 0)
CHECK (paid_amount >= 0 AND paid_amount <= total_amount + 0.01)
CHECK (due_day BETWEEN 1 AND 28)
CHECK (deleted_at IS NULL OR deleted_by_id IS NOT NULL)
CHECK (tenant_id IS NOT NULL AND society_id IS NOT NULL)  -- society-scoped tables
```

---

## 5. Security summary

Session GUC (set by Nest via `SET LOCAL` in transaction):

```sql
SELECT set_config('app.tenant_id', '...', true);
SELECT set_config('app.society_id', '...', true);
SELECT set_config('app.user_id', '...', true);
SELECT set_config('app.role', 'RESIDENT', true);
SELECT set_config('app.member_id', '...', true);
```

RLS policies: see `11_rls_policies.sql`. Residents: `member_id = current_setting('app.member_id')::uuid` on invoices/receipts/payments. Guards: visitors SELECT/INSERT only. Super admin: bypass via `app.role = 'SUPER_ADMIN'` or separate DB role.

---

## 6. Prisma vs SQL ownership

| Concern | Owner |
| --- | --- |
| Tables, FKs, basic indexes | Prisma migrate + enterprise schema |
| Partitions, matviews, triggers, RLS, functions | Raw SQL migrations |
| Sequence number generation | SQL functions called from Nest |
| Soft-delete filters | Prisma middleware / `$extends` |

Do **not** replace `schema.prisma` in production until a cutover migration plan is approved. Use `schema.enterprise.prisma` as the target design.

---

## 7. Scale assumptions

| Metric | Design response |
| --- | --- |
| 10k societies | Hash/list indexes on `(tenant_id, society_id)` |
| 500k residents | Partial index `WHERE deleted_at IS NULL` |
| Millions invoices | Indexes `(society_id, month)`, `(society_id, status)` WHERE not cancelled |
| Millions payments | Monthly partitions + BRIN on created_at |
| High concurrency | `number_sequences` row lock; Redis for hot dashboard |
| Realtime | Supabase Realtime on `notices`, `visitors`, `payments` (filtered channels) |

---

## 8. Next engineering steps

1. Review & approve this design.  
2. Apply `enterprise/` SQL on a **branch** Supabase project.  
3. Generate Prisma client from enterprise schema.  
4. Dual-write or migrate data from v1 cuid schema.  
5. Point Nest `PrismaService` + RLS session vars.  
6. Wire BullMQ matview refresh + partition maintenance cron.  
