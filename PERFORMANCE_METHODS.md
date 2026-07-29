# SocietyOne Performance Methods (system standard)

Apply **only** these methods across **API (Nest/Prisma/Supabase)**, **Admin (Next.js)**, and **Mobile (Expo)**.  
Every performance change must cite method IDs and expected **latency** / **payload** effects.

---

## Method catalog

### Database design
| # | Method |
|---|--------|
| 1 | Staging/temp tables for heavy imports |
| 2 | B-tree indexes on filter/join/sort/FK columns |
| 3 | Composite indexes matching real `WHERE` + `ORDER BY` |
| 4 | Truncate + bulk insert via `SECURITY DEFINER` RPCs |
| 5 | Batch upsert/insert RPCs (chunked writes) |
| 6 | Summary/cache tables; refresh on job completion |
| 7 | Server-side aggregation (SQL/RPC), not client reduce |
| 8 | Exact count only when needed; prefer head/approx |
| 9 | Projection — select required columns only |
| 10 | Soft-delete with indexed `deleted_at` filters |

### Data access / API
| # | Method |
|---|--------|
| 11 | Cursor or range pagination |
| 12 | Chunked related fetches (parent → children batches) |
| 13 | `Promise.all` for independent queries |
| 14 | Small `IN` batch sizes for deep children |
| 15 | `maybeSingle` / unique-key lookups |
| 16 | Precompute metrics in cache tables for first paint |
| 17 | Separate write path (ETL) from read path (UI) |

### Frontend display
| # | Method |
|---|--------|
| 18 | Page/route-keyed cache (no refetch on back) |
| 19 | In-memory filter caches invalidated on input change |
| 20 | Debounce search/filter before querying |
| 21 | Skeleton UI; don’t block whole page |
| 22 | Progressive load: summary first, details on demand |
| 23 | Client sort/filter only on small fetched pages |
| 24 | `startTransition` / deferred updates for heavy UI |

### Guardrails
| # | Method |
|---|--------|
| 25 | Measure query time, row count, payload, round-trips |
| 26 | Cap payload; else force pagination or summary RPC |
| 27 | Never load 10k+ rows into browser/app memory |
| 28 | Index every FK and frequent filter column |
| 29 | Prefer one shaped DTO/RPC over 5+ client joins |
| 30 | After import/job, refresh summaries async |

---

## Current application (SocietyOne)

### Shipped
| Methods | What | Latency / payload effect |
|--------|------|---------------------------|
| **#2 #3 #10 #28** | Hot-list composites | Index range scan vs filter-sort |
| **#6 #16 #29 #30** | `ReportingService` + matview/`rpt_*` reads; async refresh after billing/payment/member | Dashboard O(1) by society; UI not blocked on refresh |
| **#4 #5 #17** | Monthly invoices via chunked `createMany` + line `createMany` | Write RTT ≈ chunks (50) not N members |
| **#1 #5** | `stg_member_import` + `POST /members/bulk` | Admin import 1 RTT vs N POSTs |
| **#9** | Slim invoice/receipt list DTOs (no lineItems / full include) | List payload ↓ |
| **#8 #11 #26** | `limit` without COUNT; `cursor` keyset on invoices/receipts/members | Deep scroll O(log n + k); no deep OFFSET |
| **#7 #13 #22 #24** | Admin hero + chart from `/dashboard` + `/reports/monthly-series` | First paint 1–2 RTTs, O(months) not O(invoices) |
| **#11 #20 #23 #24** | Mobile Bills server filters + debounce | Smaller filtered payloads |

### Remaining (lower priority)
- **#25** Per-screen RTT/payload logging in non-prod
- Apply SQL migrations on production: `20260729120000_hot_list_indexes.sql`, `20260729130000_rpt_tables_and_staging.sql`, enterprise `09_views_matviews.sql`

---

## Solution template (required for every perf PR)

```md
### Methods used
- #N — why
- #M — why

### Expected effect
- Latency: …
- Payload / round-trips: …
```

### Example — Bulk member import
**Methods:** #1, #5, #17, #30  
**Why:** Stage Excel rows in `stg_member_import`, process in batches, refresh summaries async.  
**Expected:** Round-trips ↓ N→1; write path off UI; list cache invalidated once.

### Example — Keyset invoice list
**Methods:** #11, #9, #26  
**Why:** `?cursor=` on `(created_at, id)` with slim select.  
**Expected:** Stable latency past page 20; payload capped to page size without lineItems.

---

## Hard rules (all surfaces)

1. List endpoints always bounded (`limit` ≤ 200). **#11 #26 #27**
2. Dashboards never `SELECT *` / never reduce full ledgers on the client. **#7 #9 #16**
3. Detail screens use unique-key fetch, not list scan. **#15 #22**
4. Writes that mutate money/members invalidate TTL + schedule summary refresh. **#17 #30**
5. Any new import path uses staging + batch RPC, not N POSTs. **#1 #4 #5**
