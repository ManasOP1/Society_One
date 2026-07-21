# SocietyOne API (`api/`)

Production NestJS **backend server** — JSON REST only (no web UI).

Admin (`admin/`) and mobile (`mobile/`) both call this API.
Deploy to **Render**. See root [`STRUCTURE.md`](../STRUCTURE.md).

## Stack

- NestJS 11 + TypeScript
- Prisma ORM → Supabase PostgreSQL
- JWT auth + RBAC (`SUPER_ADMIN`, `SOCIETY_ADMIN`, `RESIDENT`)
- Razorpay Orders API + **webhook-only** payment settlement
- Supabase Storage for invoice/receipt PDFs (URLs stored in Postgres)
- BullMQ + Redis for background jobs
- Swagger at `/docs`
- Zod validation (`nestjs-zod`)
- Row Level Security SQL in `supabase/migrations/`

## Architecture

```
api/
├── prisma/                 Prisma schema + seed
├── supabase/migrations/    RLS policies
├── src/
│   ├── common/             guards, filters, decorators
│   ├── config/             env validation (Zod)
│   ├── infrastructure/     Prisma, Supabase, Razorpay, PDF, queues
│   └── modules/            Auth, Societies, Members, Flats, Billing,
│                           Payments, Receipts, Notifications, Documents,
│                           Visitors, Complaints, Reports, Audit, Settings,
│                           Community (dashboard/notices/events)
```

Every business table includes `societyId`. Application services always scope queries by the JWT `societyId` / `memberId`. RLS policies provide defense-in-depth for Supabase Data API / constrained DB roles.

## Payment settlement (never trust the client)

1. Client calls `POST /api/v1/payments/orders` → Razorpay Order created, `Payment` row `CREATED`.
2. Client completes Razorpay Checkout.
3. Razorpay sends webhook to `POST /api/v1/webhooks/razorpay`.
4. API verifies `X-Razorpay-Signature` against the **raw body**.
5. Inside a Prisma `$transaction`:
   - Idempotent `WebhookEvent` + `razorpayPaymentId`
   - Update `Payment` → `CAPTURED`
   - Update invoice paid/outstanding/status
   - Create `Receipt`
   - Write `AuditLog`
6. After commit, BullMQ jobs:
   - Generate invoice/receipt PDFs → upload Supabase Storage → save URLs
   - WhatsApp notification
   - Email notification

## Quick start

```bash
cd api
cp .env.example .env
# fill DATABASE_URL, JWT secrets, Supabase, Razorpay, Redis

npm install
npx prisma generate
npx prisma migrate dev --name init
psql "$DATABASE_URL" -f supabase/migrations/20260720000000_rls_policies.sql
npx ts-node prisma/seed.ts

# Redis must be running for workers
npm run start:dev
```

- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/docs`

### Seed accounts

| Role | Email | Password |
|------|-------|----------|
| Society admin | `admin@greenvalley.in` | `admin123` |
| Resident | `rahul.patil@email.com` | `resident123` |
| Super admin | `superadmin@societyone.app` | `superadmin123` |

## Mobile client

Point Expo `EXPO_PUBLIC_API_BASE_URL` at this API (e.g. `http://localhost:4000/api/v1`).

Payment UX should create a Razorpay **order** via this API and wait for webhook settlement (poll receipt / invoice), instead of treating client checkout success as final.

## Horizontal scale

- Stateless NestJS instances behind a load balancer
- Shared Supabase Postgres + Redis
- BullMQ workers can run in dedicated processes (`QueueModule` processors)
- Use PgBouncer / Supabase pooler connection string for many instances

## Scripts

```bash
npm run start:dev
npm run build
npm run start:prod
npx prisma migrate dev
npx prisma generate
npx ts-node prisma/seed.ts
```
