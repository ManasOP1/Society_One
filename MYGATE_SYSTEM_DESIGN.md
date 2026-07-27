# SocietyOne × MyGate — System Design & Fast Database

How SocietyOne is shaped like **MyGate**: one platform replacing WhatsApp groups + Excel sheets, built on **four pillars**, with a database tuned for **gate-speed lookups** and **audit-ready money**.

Canonical table DDL: `api/supabase/migrations/20260727160000_mygate_pillars.sql`  
Prisma models: `api/prisma/schema.prisma`  
Full table encyclopedia: [`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md)

---

## 1. What MyGate does (reference model)

MyGate combines **physical gate security**, **society ERP (billing/accounting)**, and **resident ops** in one cloud system:

| Layer | MyGate behaviour | SocietyOne equivalent |
| --- | --- | --- |
| Gate app | OTP/QR pass, approve queue, visitors-inside, photo log | `visitor_passes` + `gate_events` + guard APIs |
| Resident app | Pre-approve guests, pay dues, book amenities, raise tickets, panic | Mobile app + new pillar tables |
| Admin / MC | Billing, notices, docs, reports | Admin Next.js + Nest API |
| Accounting | Invoices, collections, statements | `invoices`/`receipts` + **`ledger_*` + `tax_logs`** |

**Core gate flow (MyGate → us):**

```text
Resident creates pre-approval
  → visitor_passes (pass_code + qr_token, validity window)
Guest arrives → Guard enters OTP / scans QR
  → app.validate_visitor_pass(society_id, code)  -- indexed hot path
  → gate_events ENTRY (denormalized name/flat/vehicle)
  → visitors row (entry_at, status INSIDE)
Exit → gate_events EXIT + visitors.exit_at
```

---

## 2. Four pillars (product → data)

### Pillar 1 — Billing & Accounting

**Already strong:** monthly invoices, line items, payments, receipts, Razorpay fields, expenses, society_settings (maintenance / sinking / parking charges).

**MyGate-aligned additions (speed + audit):**

| Table | Role |
| --- | --- |
| `ledger_accounts` | Chart of accounts (ASSET / LIABILITY / INCOME / EXPENSE / EQUITY) |
| `ledger_entries` + `ledger_lines` | Double-entry journals sourced from payments, expenses, amenity charges |
| `tax_logs` | GST / TDS period rows for treasurer exports |

**Amenity → ledger:** confirmed `amenity_bookings.charge_amount` posts a ledger entry and can attach to next `invoice_id`.

**Speed tips:** index `(society_id, entry_date DESC)`; never update historical lines — reverse with a new entry.

### Pillar 2 — Smart Security & Gate

| Table | Role |
| --- | --- |
| `visitor_passes` | Pre-approved OTP/QR; `UNIQUE(society_id, pass_code)` |
| `gate_events` | Append-only timeline (ENTRY/EXIT/DENY/OVERRIDE) — **denormalized** `flat_label`, `person_name` |
| `visitors` | Live presence (+ `category_code`, `entry_at`/`exit_at`, `pass_id`) |
| `staff_profiles` | Maids, drivers, society staff |
| `staff_attendance` | Check-in / check-out (partial index on open shifts) |
| `panic_alerts` | Panic button → open alerts (partial index `WHERE status_code = 'OPEN'`) |

**Why this is fast:**

- OTP validation hits a **partial unique-style index** on active passes — no join to members/flats in the critical path.
- Guard “who’s inside” lists read **denormalized** `gate_events` / `visitors` columns.
- `gate_events` uses btree `(society_id, created_at DESC)` + **BRIN(created_at)** for long history.
- Panic feed uses **partial index** only on `OPEN` rows (tiny working set).

SQL helper: `app.validate_visitor_pass(society_id, pass_code)` — `SELECT … FOR UPDATE` then bump `entries_used`.

### Pillar 3 — Helpdesk & Amenities

| Table | Role |
| --- | --- |
| `complaints` (+ `assigned_to_id`) | Tickets |
| `complaint_events` | Assignment / status / comment history (append-only) |
| `amenities` | Clubhouse, court, hall + hourly charge |
| `amenity_bookings` | Slot booking; overlap index on `(amenity_id, starts_at, ends_at)` |

**Overlap rule (app):** before insert, query confirmed bookings where  
`starts_at < :ends AND ends_at > :starts` using `ix_amenity_bookings_range`.

### Pillar 4 — Compliance & Communication

| Existing | New |
| --- | --- |
| `notices`, `documents`, `society_events` | `polls`, `poll_options`, `poll_votes` |

**Fast tallies:** `poll_options.vote_count` is denormalized; increment in the **same transaction** as `poll_votes` insert (avoid `COUNT(*)` on every results screen).

---

## 3. System architecture (runtime)

```text
┌─────────────┐   JWT    ┌──────────────┐   Prisma    ┌─────────────────┐
│ Admin Web   │ ───────► │ Nest API     │ ──────────► │ Supabase PG     │
│ Mobile App  │          │ /api/v1      │             │ + Redis/BullMQ  │
│ Guard App*  │          │              │             │ + Storage PDFs  │
└─────────────┘          └──────────────┘             └─────────────────┘
                              │
                              ├── Billing jobs (monthly invoices)
                              ├── Push (device_push_tokens / Expo)
                              └── Refresh matviews (dashboard)
```

\*Guard app = mobile role `SECURITY_GUARD` (or dedicated screen) calling pass validation + panic ack.

**Tenancy (unchanged):** `tenant_id` + `society_id` on every society-scoped row; RLS policies remain defense-in-depth.

---

## 4. Hot-path query recipes

```sql
-- Guard: validate OTP (uses ix_visitor_passes_active_lookup)
SELECT * FROM app.validate_visitor_pass(:society_id, :pass_code);

-- Guard: open panic feed
SELECT * FROM panic_alerts
WHERE society_id = :sid AND status_code = 'OPEN'
ORDER BY created_at DESC
LIMIT 50;

-- Amenity overlap check
SELECT 1 FROM amenity_bookings
WHERE amenity_id = :aid
  AND deleted_at IS NULL
  AND status_code IN ('PENDING','CONFIRMED')
  AND starts_at < :ends AND ends_at > :starts
LIMIT 1;

-- Poll results (no COUNT join)
SELECT label, vote_count FROM poll_options
WHERE poll_id = :pid ORDER BY sort_order;
```

---

## 5. Apply migration

On Supabase (SQL editor or CLI):

```bash
# From repo
psql "$DATABASE_URL" -f api/supabase/migrations/20260727160000_mygate_pillars.sql
```

Then regenerate Prisma client:

```bash
cd api && npx prisma generate
```

Wire Nest modules/controllers next (passes, panic, amenities, polls, ledger) — schema is ready.

---

## 6. Gap vs full MyGate (honest backlog)

| MyGate feature | Status here |
| --- | --- |
| Pre-approve OTP/QR | **Schema + validate fn ready** — API/UI next |
| Delivery / staff tracking | **Schema ready** |
| Panic button | **Schema ready** |
| Amenity booking → invoice | **Schema ready** (posting job next) |
| Double-entry + GST/TDS logs | **Schema ready** |
| Boom barrier / ANPR / RFID | Out of scope (hardware integrations later) |
| Guard-to-guard VoIP | Out of scope |
| E-invoice ASP network | Out of scope (tax_logs is export base) |

---

## 7. Performance checklist (keep forever)

1. Never join 5 tables on the gate scan path — use denormalized `gate_events` / pass row.  
2. Prefer **partial indexes** for `ACTIVE` / `OPEN` / `INSIDE` working sets.  
3. Money trail is **append-only** (`payment_transactions`, `ledger_lines`, `gate_events`, `complaint_events`).  
4. Refresh reporting matviews on a cron; don’t compute dashboards with full table scans.  
5. Partition `gate_events` monthly when a society exceeds ~5–10M events (`app.ensure_month_partitions`).

---

*Aligned with MyGate visitor/security + ERP patterns; tailored to SocietyOne’s existing Nest/Prisma/Supabase stack.*
