# Migration Order

Apply on a **branch** Supabase project first. Do not replace live `schema.prisma` until cutover is approved.

| Order | File / step | Notes |
| --- | --- | --- |
| 01 | `enterprise/01_extensions_types.sql` | pgcrypto, citext, `app` schema helpers |
| 02 | `enterprise/02_lookup_tables.sql` | Role/status code tables + seed |
| 03 | Prisma migrate from `schema.enterprise.prisma` **or** hand-written DDL for tenants→expenses | Creates base tables + FKs |
| 04 | Convert hot tables to PARTITION BY RANGE + `06_partitioned_ledgers.sql` | Attach 2026–2027 months |
| 05 | Check constraints + FK RESTRICT audit | amounts > 0, due_day 1–28 |
| 06 | `enterprise/10_functions_triggers.sql` | Numbering, bills, audit, payment hooks |
| 07 | Attach `updated_at` / audit triggers to tables | Generated list in runbook |
| 08 | `enterprise/09_views_matviews.sql` | Views + matviews + unique indexes |
| 09 | `enterprise/12_indexes.sql` (from indexing doc) | CONCURRENTLY on prod |
| 10 | `enterprise/11_rls_policies.sql` | After app sets `app.*` GUCs |
| 11 | Grants to `app_runtime` (NOBYPASSRLS) | Migrator role keeps bypass |
| 12 | Seed lookups already done; seed demo tenant/society | `prisma/seed.enterprise.ts` (TBD) |
| 13 | BullMQ cron: `app.refresh_reporting_matviews()` | Every 5–15 min |
| 14 | Monthly cron: `app.ensure_month_partitions(..., year)` | Create next quarter |

## Applied status (20 Jul 2026)

Enterprise schema was **built on the linked Supabase project** (`twgbhmzxwwxcnkhckkup`):

```bash
cd api
node scripts/build-enterprise-db.js pre
npx prisma db push --schema=prisma/schema.enterprise.prisma
node scripts/build-enterprise-db.js post   # first time only (RLS)
node scripts/build-enterprise-db.js seed   # idempotent-ish demo data
node scripts/verify-enterprise-db.js
```

Verified: **41 tables**, **5 matviews**, **3 views**, **app.*** functions, RLS policies on core tables, demo seed (1 tenant, 1 society, 3 users).

`prisma/schema.prisma` was replaced with the enterprise schema for client generation. NestJS domain services still expect the v1 cuid model — adapt API modules next.

Physical RANGE partitioning of hot tables is prepared (`app.ensure_month_partitions`) but tables remain non-partitioned until a dedicated conversion window.

## Cutover from v1 (cuid schema)

1. Dual-write or ETL: map `societyId` → create `tenant` 1:1, new UUIDs or keep via uuid mapping table.
2. Expand invoice JSON `lineItems` → `invoice_lines`.
3. Backfill `payment_transactions` from historical CAPTURED payments.
4. Switch Nest to enterprise client; feature-flag RLS.
5. Decommission v1 tables after checksum + webhook idle.

## Rollback

- Keep v1 schema until 2 weeks stable.
- Matviews/RLS can be dropped without losing OLTP data.
- Partition conversion is the riskiest step — rehearse on branch.
