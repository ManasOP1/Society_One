# Backup & Disaster Recovery

## Objectives

| Metric | Target |
| --- | --- |
| RPO (data loss) | ≤ 5 minutes (PITR) |
| RTO (restore API) | ≤ 1 hour for region failure |
| Financial integrity | Zero silent loss of CAPTURED payments |

## Supabase / Postgres

1. **Point-in-time recovery (PITR)** enabled on Pro+; verify WAL retention ≥ 7 days (30 days prod).
2. **Daily logical dump** (optional) of `societies`, `members`, `invoices`, `payments`, `receipts`, `payment_webhooks` to cold storage.
3. **Partition drop policy:** detach partitions older than retention (e.g. audit 24 months) → archive to object storage → drop.
4. **Never** hard-delete `payment_transactions` / `payment_webhooks`.

## Application DR

| Failure | Response |
| --- | --- |
| Primary DB down | Supabase failover; Nest reconnect; degrade non-critical matview refresh |
| Redis down | Bypass cache; BullMQ delayed jobs; payment settle still OK on DB |
| Razorpay outage | Orders fail soft; webhooks replay from provider dashboard |
| Region loss | Restore PITR to new project; update `DATABASE_URL`; replay unprocessed webhooks |

## Runbooks

1. **Restore drill** quarterly: clone to branch DB, run `pg_restore`/PITR, smoke login + invoice list + webhook idempotency.
2. **Webhook replay:** select `payment_webhooks WHERE processed_at IS NULL`.
3. **Checksum:** nightly job compare `sum(payments.amount) WHERE CAPTURED` vs `sum(receipts.total_paid)` per society.

## Secrets

- DB password rotation via Supabase; update Nest secrets; rolling restart.
- Backup encryption at rest (provider default) + restricted IAM on dump buckets.
