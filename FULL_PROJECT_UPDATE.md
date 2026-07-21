# SocietyOne — Complete Project Update

**Last verified:** 20 July 2026  
**Repository:** `SocietyOne/`  
**Status covered by this document:** `api/` (NestJS production API), `admin/` (Next.js web console; formerly `backend/`), and `mobile/` (Expo app; formerly `frontend/`). See root `STRUCTURE.md` for the current layout.

---

## 1. Executive summary

SocietyOne now contains **three** independently runnable applications:

```text
SocietyOne/
├── api/       NestJS production API (Supabase Postgres + Razorpay + BullMQ)
├── backend/   Next.js society and super-admin web console (legacy localStorage demo)
└── frontend/  Expo mobile/web application for residents and society admins
```

All three model the same core domain: societies, members, flats, settings, invoices, payments, receipts, notices, events, visitors, complaints, documents and audit.

### What works today

**Production API (`api/`)**

- NestJS 11 + Prisma 7 → Supabase PostgreSQL (Session pooler recommended).
- JWT access/refresh auth + RBAC (`SUPER_ADMIN`, `SOCIETY_ADMIN`, `RESIDENT`).
- Tenant-scoped domain modules: societies, members, flats, billing, payments, receipts, notifications, documents, visitors, complaints, reports, audit, settings, community (dashboard/notices/events).
- Razorpay Orders + **webhook-only** settlement (HMAC on raw body, transactional payment → invoice → receipt → audit).
- BullMQ workers for billing, reminders, PDF upload (Supabase Storage), email/WhatsApp stubs.
- Swagger at `/docs`, Zod env/DTO validation, throttling, RLS SQL migration.
- `npm run build` succeeds with the full `AppModule` wiring.

**Legacy web admin (`backend/`)**

- Multi-society demo data for Green Valley, Sunrise Heights and Lakeview.
- Society-admin and super-admin logins, dashboards, members, invoices, collection desk, finance, reports, notices, events, visitors and settings (localStorage).

**Mobile (`frontend/`)**

- Resident and admin login (mock mode by default).
- Dashboard, invoices, receipts, pay/record collection, notices, events, visitors, profile.
- Invoice/receipt PDF share, lime/ink theme, TanStack Query caches scoped by user + society.

### Important architecture truth

| Folder | Role today |
| --- | --- |
| `api/` | **Real production backend.** HTTP REST under `/api/v1`, Postgres, JWT, Razorpay webhooks, queues. |
| `backend/` | **Legacy UI demo only.** Next.js + browser localStorage services — not an HTTP API and not wired to `api/` yet. |
| `frontend/` | Expo app. Empty `EXPO_PUBLIC_API_BASE_URL` → in-app mock. Point it at `http://localhost:4000/api/v1` to use Nest. |

Therefore:

- Mobile mock and web admin localStorage still do **not** sync with each other or with Postgres until clients are rewired.
- Mobile `POST /payments` (mock) must become `POST /payments/orders` + poll for webhook-settled receipt when using Nest.
- Prefer [`api/README.md`](./api/README.md) for API ops; this file remains the full product inventory.

---

## 2. How to run the complete project

The applications are separate npm projects, not an npm-workspaces monorepo. There is no root `package.json` or root Git repository; only `frontend/` is a Git repo today. Install and run each app from its own folder.

### Run the NestJS production API

```bash
cd api
cp .env.example .env
# Set DATABASE_URL (Supabase Session pooler), JWT secrets, Supabase keys, Razorpay, Redis

npm install
npx prisma generate
npx prisma migrate dev --name init
# Apply RLS (example):
# psql "$DATABASE_URL" -f supabase/migrations/20260720000000_rls_policies.sql
npx ts-node prisma/seed.ts   # or: npm run prisma:seed

# Redis required for BullMQ workers
npm run start:dev
```

- API base: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/docs`
- Production build: `npm run build` then `npm run start:prod`

**Database connection**

- Use Supabase **Session pooler** (`…pooler.supabase.com:5432`) for the Nest + Prisma/`pg` Pool process.
- Avoid Transaction pooler for this API (prepared statements / Prisma transactions).
- `DATABASE_URL` must be `postgresql://…` (not `prisma+postgres://`).
- Env validation accepts `SUPABASE_SERVICE_ROLE_KEY` or newer `SUPABASE_SECRET_KEY`.

### Run the Next.js admin console (legacy demo)

```bash
cd backend
npm install
npm run dev
```

- URL: `http://localhost:3000`
- Society-admin login: `http://localhost:3000/login`
- Super-admin login: `http://localhost:3000/super-admin/login`
- Production build: `npm run build`
- Production server: `npm start`
- Lint: `npm run lint`

### Run the Expo application

```bash
cd frontend
npm install
npm start
```

- Metro/Expo port: `8081`
- Press `a` for Android, `i` for iOS or `w` for web.
- Android shortcut: `npm run android`
- iOS shortcut: `npm run ios`
- Web shortcut: `npm run web`
- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`

All three can run at once (`api` `:4000`, `backend` `:3000`, `frontend` `:8081`).

### Mobile API configuration

Create `frontend/.env` from `.env.example`:

```env
# Empty = use the built-in mock API
EXPO_PUBLIC_API_BASE_URL=

# Live Nest API (same machine / LAN as needed)
# EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
```

Restart Expo after changing this value.

---

## 3. Demo accounts and seeded societies

### Society admin accounts

| Society | Admin email | Password |
| --- | --- | --- |
| Green Valley Residency | `admin@greenvalley.in` | `admin123` |
| Sunrise Heights | `admin@sunriseheights.in` | `admin123` |
| Lakeview Apartments | `admin@lakeview.in` | `admin123` |

These accounts work in the web admin demo and the mobile mock. After `api` seed, Green Valley admin (`admin@greenvalley.in` / `admin123`) is also in Postgres.

### Mobile resident accounts

Every seeded member is also a mock resident account. The password is `resident123`.

Examples:

| Society | Resident email | Password | Flat |
| --- | --- | --- | --- |
| Green Valley Residency | `rahul.patil@email.com` | `resident123` | A-203 |
| Sunrise Heights | `neha.k@email.com` | `resident123` | A-101 |
| Lakeview Apartments | `pooja.g@email.com` | `resident123` | East-12 |

Additional seeded residents are defined in `frontend/src/api/mock/db.ts`. Nest seed currently creates Green Valley + Rahul Patil resident + Jonathan Smith admin + super-admin.

### Super administrator

| Email | Password |
| --- | --- |
| `superadmin@societyone.app` | `superadmin123` |

In the web demo these credentials live in client code. In `api/` they are bcrypt-hashed users in Postgres after seeding.

### Seeded society coverage

- **Green Valley Residency** — Baner Road, Pune; wings A–D *(also seeded in Nest Prisma)*.
- **Sunrise Heights** — Hinjewadi Phase 1, Pune; wings A–C *(demo/mock only today)*.
- **Lakeview Apartments** — Kharadi, Pune; East and West wings *(demo/mock only today)*.
- Each society has separate members, invoices, receipts, notices, events, visitors and settings in the current demo stores.
- All Nest and demo list reads are filtered using `societyId`.

---

## 4. Roles and data visibility

### Resident

A resident should only see:

- Their own profile, wing and flat.
- Their own outstanding dues and next due invoice.
- Their own invoices, receipts and payment history.
- Society notices and events for their society.
- Read-only gate entries for their society (currently society-wide, not flat-scoped).
- Society contact, registration, bank and UPI information.

The mobile mock API enforces billing isolation by combining the authenticated account with society/member filtering for invoices and receipts. Visitors are filtered by `societyId` only for both residents and admins.

### Society admin

A society admin sees:

- The selected society only.
- Society-wide invoices, outstanding balances, receipts and collections.
- Resident name and flat details in collection lists.
- Society settings and payment details.
- Admin-specific “Record payment” language and offline collection modes.
- The complete web operations console for that society.

### Super admin

The web super admin can:

- View all registered societies.
- Search by society, address or admin email.
- See total society, active society and flat counts.
- Create a new society and its first admin.
- Activate or deactivate a society.

### Isolation already implemented

- Web services filter records by the logged-in `society.id`.
- Mobile mock endpoints resolve the authenticated user and filter by `societyId` and, for residents, member identity.
- Mobile TanStack Query keys contain `userId` and `societyId`.
- The mobile query cache is cleared on login, logout and failed token refresh, preventing one account from seeing another account’s cached data.
- Notice and visitor seeding appends data instead of overwriting records for previously seeded societies.

### Production limitation

Roles in the **web admin** and **mobile mock** are still client-enforced. The **Nest API** enforces roles with JWT + `RolesGuard` / `TenantGuard` and scopes queries by `societyId` / `memberId`. RLS SQL in `api/supabase/migrations/` adds defense-in-depth for constrained DB roles.

Client-side filtering and localStorage are not a security boundary. Production multi-tenancy must be enforced in a database/API using authenticated server-side queries, authorization checks and preferably row-level security.

---

## 5. Frontend/mobile application architecture

### Runtime and navigation

- Expo SDK 54, React Native and TypeScript.
- Expo Router file-based routes.
- A protected root stack switches automatically between `/login` and the authenticated application.
- Floating five-item bottom navigation:
  - Home
  - Payments
  - Visitors
  - Community
  - Profile
- Detail routes open above the tab navigator.
- Safe-area padding supports notches, status bars and the floating bottom bar.
- Content has a maximum width on tablets/web instead of stretching indefinitely.

### Mobile design system

Current design language:

- Lime accent: `#D6F252`
- Ink/dark surface: `#131417`
- Warm light background: `#F1F0EA`
- Inter typography, weights 500–800.
- 8-point spacing system.
- Rounded cards (up to 28px) and full pill controls.
- Soft shadows and dark content surfaces.
- Full light/dark palette selected from the system color scheme.
- Feather/Lucide-style outlined icons.
- Minimum touch-friendly control sizes and accessibility labels on core icon/search/list actions.

Reusable UI includes:

- `AppText`
- `Button`
- `Card`
- `Badge`, `StatusBadge`, `OutlineBadge`
- `Avatar`
- `Segmented` and `ChipRow`
- `SearchField`
- `Skeleton` and `ListSkeleton`
- `EmptyState` and `ErrorState`
- `Screen` and virtualized `ListScreen`
- `SocietyLogo`

### Data and request flow

1. A screen calls a typed hook from `frontend/src/hooks/queries.ts`.
2. The hook calls a typed endpoint in `frontend/src/api/endpoints.ts`.
3. Axios in `frontend/src/api/client.ts` sends the request.
4. With no base URL, the Axios request is handled by `frontend/src/api/mock/adapter.ts`.
5. With a base URL, it is sent to the configured server.
6. TanStack Query caches the response using the active account and society scope.
7. Screens render loading skeletons, data, an empty state or a retryable error.

### Authentication and tokens

- Access and refresh tokens are stored with `expo-secure-store` on native platforms.
- Web uses browser storage through the token-store abstraction.
- The access token is added as `Authorization: Bearer <token>`.
- A 401 starts one shared refresh request, avoiding concurrent refresh storms.
- The original request is retried once after refresh.
- Refresh failure clears tokens, clears query data and signs the user out.
- Stored session data is restored when the application launches from the saved refresh token and user JSON.
- `GET /me` exists in the typed client but is not currently called during session restore; access-token freshness is validated on the first authenticated request that returns 401.

---

## 6. Frontend pages and complete user flow

### 6.1 `/login` — Login

Visible UI:

- SocietyOne logo, title and sign-in description.
- Email and password inputs.
- Show/hide password control.
- Disabled/loading sign-in button behavior.
- Inline API/authentication error message.
- Demo-mode card containing the three admin accounts and a resident example.

Flow:

1. Enter a resident or admin email and password.
2. The app calls `POST /auth/login`.
3. On success, access/refresh tokens and user data are stored.
4. The app automatically replaces the login route with the tab application.
5. On failure, the API message is shown without leaving the page.

Not yet implemented: registration, OTP verification, forgot password, onboarding and biometric login.

### 6.2 `/` or `/(tabs)` — Home dashboard

Visible UI:

- Avatar, role-aware greeting and society name.
- Community/message and notification icon actions (both currently open Community; the bell badge is decorative, not a notifications system).
- Shared search field.
- Outstanding/collection amount chip and open-invoice count.
- Dashboard summary also computes `visitorsToday`, but that value is not yet rendered on Home.
- Horizontal quick links for invoices, receipts, visitors and events.
- Latest announcement card with read-more navigation.
- Role-aware quick actions.
- Upcoming event card.
- Last payment/receipt card.
- Society logo/name footer.
- Pull-to-refresh, dashboard skeletons and retryable error card.

Resident behavior:

- Greeting says “Hello”.
- Financial labels use “Dues” and “Pending Bills”.
- Primary action is “Pay Dues”.
- Tapping an outstanding amount opens the next invoice’s payment page.

Admin behavior:

- Greeting says “Welcome”.
- Labels use “Collections” and “Open Invoices”.
- Primary action is “Collect Dues”.
- Tapping an outstanding amount opens the same route in record-payment mode.

Search flow:

1. Enter an invoice, resident, flat, status or amount term.
2. Submit from the keyboard.
3. The Payments page opens with the query already applied.

### 6.3 `/bills` — Payments/Collections, Invoices tab

Visible UI:

- Role-aware title: **Payments** for residents, **Collections** for admins.
- Invoices/Receipts segmented switch.
- Dark total-pending card with maintenance and arrears/penalty breakdown.
- Role-aware Pay/Record button for the next due invoice.
- Search by invoice, owner, flat, status or amount.
- Year chips and month chips.
- Status chips: All, Pending, Overdue, Partial and Paid.
- Result count and “Clear filters (n)” action.
- Invoice cards with month, invoice number, due date, amount and status.
- Admin cards additionally show owner and flat.
- Pull-to-refresh.

Performance behavior:

- The invoice and receipt lists use `FlatList` through `ListScreen`.
- Only a window of rows is mounted, improving long-list scrolling.
- Current demo filtering is instant client-side filtering over fetched data.

Navigation:

- Select an invoice to open `/invoice/[invoiceNo]`.
- Select Pay/Record to open `/pay/[invoiceNo]`.

States:

- Skeleton rows while loading.
- Retry action on API failure.
- Empty state changes its message when filters are active.

### 6.4 `/bills?tab=Receipts` — Payments/Collections, Receipts tab

Visible UI:

- Receipt/invoice/mode/amount search.
- Year and month filters.
- Payment-history count.
- Active-filter count and one-tap clear.
- Receipt cards showing receipt number, month, mode, date and total paid.
- Admin cards additionally show resident and flat.
- Virtualized rows and pull-to-refresh.

Navigation:

- Select a receipt to open `/receipt/[receiptNo]`.

### 6.5 `/invoice/[invoiceNo]` — Invoice detail

Visible UI:

- Society logo, name, address, registration number and PAN.
- Billing month, invoice number and status.
- Billed-to resident, flat/wing, issue date and due date.
- Maintenance line items and subtotal.
- Arrears/adjustment section when applicable.
- Total amount, paid amount and balance due.
- Amount in Indian words.
- Society bank account, IFSC and UPI details.
- Notes and interest information.
- Role-aware Pay/Record Payment action when a balance exists.
- Share PDF action.

Flow:

1. Invoice and society settings load in parallel.
2. The payment action appears only for a non-cancelled invoice with an outstanding balance.
3. Share PDF creates formatted HTML, renders it through `expo-print` and opens the native share sheet through `expo-sharing`.
4. Web uses the print behavior supported by Expo.

States:

- Document-shaped skeleton.
- Combined retry if either the invoice or settings request fails.
- Share-generation error displayed on the page.

### 6.6 `/pay/[invoiceNo]` — Pay or record a collection

Visible UI:

- Dark outstanding hero with invoice period, due date and breakdown.
- Editable amount.
- Full and half amount shortcuts.
- Validation that amount is greater than zero and no more than outstanding.
- Payment/collection mode cards.
- Mutation error state.
- Loading/disabled primary action.

Resident payment modes:

- UPI
- Credit Card
- Debit Card
- Net Banking
- Wallet

Admin collection modes:

- UPI
- Cash
- Cheque
- Net Banking
- Other

Flow:

1. The invoice loads and defaults to the full outstanding amount.
2. The app blocks cancelled and fully paid invoices.
3. Submit calls `POST /payments`.
4. The mock service applies full or partial payment, recalculates the invoice and creates a receipt.
5. Relevant invoice, receipt and dashboard queries are invalidated/refetched.
6. A success screen shows amount, receipt, invoice, UTR, date and remaining balance.
7. “View Receipt” replaces the page with the receipt detail.
8. “Done” returns to the tab application.

Current limitation:

- Resident card/UPI/wallet choices are simulated modes. No Razorpay or bank gateway is connected.

### 6.7 `/receipt/[receiptNo]` — Receipt detail

Visible UI:

- Society logo/name/address.
- Paid amount hero and PAID badge.
- Amount in words.
- Receipt and invoice numbers.
- Month, resident, flat, date, payment mode, UTR, bank and collector.
- Share PDF button.

Flow:

- Loads receipt and society settings.
- Generates and shares a formatted receipt PDF.
- Provides skeleton, retry and share-error states.

### 6.8 `/visitors` — Gate Updates

Visible UI:

- All, Visitors, Parcel and Helpers segmented filters.
- Read-only cards with name, purpose, flat, category, logged badge, expected time and vehicle.
- Category is derived from visitor/purpose text.
- Pull-to-refresh, skeletons, retry and category-aware empty states.

Resident/mobile behavior:

- Read-only by design.
- No approve/reject controls because entries are expected from the connected gate application.
- Both residents and admins currently see the full society gate log, not only visitors for their own flat.

### 6.9 `/community` — Notices and Events

Common UI:

- Notices/Events segmented switch.
- Shared search field.
- Pull-to-refresh, list skeletons, retryable errors and search-aware empty states.

Notices tab:

- Searches notice title and body.
- Shows title, publisher, pinned/published badge, excerpt, category and date.
- Selects a notice to open `/notice/[id]`.

Events tab:

- Searches title, location and description.
- Shows date tile, title, location, event status and date.
- Selects an event to open `/event/[id]`.

### 6.10 `/notice/[id]` — Notice detail

- Pinned badge where applicable.
- Full title, published date and complete notice body.
- Skeleton and retryable error state.

### 6.11 `/event/[id]` — Event detail

- Upcoming/Ongoing/Completed badge.
- Event title, start/end date, location and RSVP count.
- Full event description.
- Skeleton and retryable error state.

### 6.12 `/profile` — Profile and society information

Visible UI:

- Dark profile hero with avatar, name and email.
- Resident: flat, wing and Resident chips.
- Admin: society-name and Admin chips; no misleading resident flat chip.
- Society logo, name, address, registration number and PAN.
- User contact number.
- Society bank, account number, IFSC and UPI.
- Sign-out action with native confirmation.
- App version and a visible demo-mode label when using the mock API.
- Pull-to-refresh, skeletons and retry.

Logout flow:

1. Confirm sign out on native platforms.
2. Secure tokens and stored user data are cleared.
3. TanStack Query cache is cleared.
4. Root navigation returns to `/login`.

---

## 7. Next.js admin application architecture

> **Status:** Legacy demo UI. Production HTTP/data live in `api/`. This section still documents the localStorage console until it is rewired.

### Current persistence

Operational data is stored in browser localStorage behind service modules:

- Society registry and status
- Admin session
- Imported/created members
- Society settings and uploaded logo data URLs
- Invoices and statuses
- Receipts/payments
- Expenses
- Notices
- Events
- Visitor records
- Audit log
- Simulated WhatsApp log

This allows the web UI to work without a server database, but data is browser/device specific and can be cleared by the user.

### Admin navigation

- Desktop: collapsible/hover-expanding left sidebar.
- Mobile/tablet: header and drawer navigation.
- Floating quick-action menu links to common operational pages.
- `AuthGuard` redirects unauthenticated society users to `/login`.
- `SuperAdminGuard` protects `/super-admin`.
- Responsive cards and horizontally scrollable data tables.
- Theme provider supports light/dark appearance.

---

## 8. Backend/admin pages and complete flow

### 8.1 `/login` — Society admin login

Visible UI:

- Society selector populated from the society registry.
- Selected society address.
- Admin email auto-filled from the selected society.
- Password input and inline validation error.
- Link to super-admin login.

Flow:

1. Select an active society.
2. Enter its admin credentials.
3. The client validates society ID, email and password.
4. Session is stored under the SocietyOne localStorage session key.
5. The user is redirected to `/`.
6. Inactive societies are excluded from the selector.

### 8.2 `/super-admin/login` — Super-admin login

- Prefilled demo super-admin email.
- Password input and inline error.
- Successful login stores the super-admin session and opens `/super-admin`.
- Link returns to society-admin login.

### 8.3 `/super-admin` — Society registry

Visible UI:

- Total society, active society and total flat counts.
- Searchable society directory.
- Society name/address, admin, flat count, collected amount and status.
- Activate/deactivate action.
- Create-society modal.
- Logout.

Create flow:

1. Enter society name/address, comma-separated wings, flat count, admin name/email/password, registration number and PAN.
2. Validation requires society name, admin name and email.
3. A unique society is added to the local registry.
4. The new society becomes available on the society-admin login page.
5. Default settings and service data are created as modules are opened.

### 8.4 `/` — Society dashboard

Visible UI:

- Society-specific greeting, address and current date.
- Members/flats, collected, pending and fund hero statistics.
- Featured event.
- Calendar.
- Monthly income/expense chart.
- Members-ratio chart.
- Outstanding-dues widget.
- Shortcuts to Invoices, Collection Desk, Members and Reports.

Data flow:

- Uses the authenticated society.
- Invoice statistics come from the invoice service.
- Members come from the society-scoped auth/member store.
- Financial chart seed data is selected by society ID.

### 8.5 `/members` — Member directory

Visible/working features:

- Society-scoped member table.
- Search, wing filter and maintenance-status filter.
- Pagination using TanStack Table.
- Member avatar, wing, flat, owner, tenant, phone, email, parking and maintenance status.
- View, edit and delete actions.
- Add-member modal with validation.
- Import members from Excel.
- Download import template.
- Export members to Excel.
- Import result messages.

Mutation behavior:

- Added/imported members are attached to the active society.
- Edit/delete operations update localStorage.
- Important actions write an audit record.

### 8.6 `/invoices` — Billing document management

Visible/working features:

- Billing-month selector.
- Generate monthly invoices for society members.
- Expected, collected, outstanding, collection percentage, pending, partial, late/overdue and today’s collection metrics.
- Search by invoice, flat or owner.
- Status filter.
- Invoice table with totals, paid amount, due date and status.
- Preview invoice document.
- Open public invoice route.
- Duplicate and delete invoice.
- Change invoice status.
- Mock WhatsApp reminder preview/send.
- Browser print/PDF behavior.

Generation flow:

1. Select a month.
2. “Generate Monthly” creates missing invoices for the active society’s members.
3. Existing member/month invoices are not duplicated by bulk generation.
4. Invoice number uses the society’s configured prefix.
5. Maintenance and arrears items are built from society settings.
6. Totals/status are recalculated and an audit entry is written.

Current invoice edge cases:

- UI month options are currently hardcoded (June–August 2026 demo months).
- “Mark Partial” can set a half-paid invoice without creating a matching receipt.
- Marking an invoice Pending can zero its paid amount while older receipts remain.
- Deleting an invoice does not cascade-delete related receipts, WhatsApp logs or audit rows.
- Every society still defaults to the same `INV`/`REC` prefixes, so public global `getByNo()` lookups can collide across societies.

### 8.7 `/payments` — Payments & Collections desk

Purpose: an admin collection desk, not a resident checkout.

Visible/working features:

- Monthly/annual mode.
- Dynamic available years plus month/year selection.
- Collection percentage hero.
- Expected, collected, outstanding, pending, partial, late and today metrics.
- Dues, Receipts and All Invoices tabs.
- Search by invoice, resident, flat or receipt.
- Record-payment modal.
- Full or partial amount validation.
- Modes: UPI, Cash, Net Banking, Credit Card and Cheque.
- Receipt ledger with links to public receipts.
- Invoice links.
- Period CSV export.

Record-payment flow:

1. Select a due invoice.
2. Outstanding amount is prefilled.
3. Enter a full or partial amount and payment mode.
4. Amount cannot exceed outstanding.
5. The payment service updates invoice paid/outstanding/status values.
6. A society-prefixed receipt and UTR/reference are generated.
7. The UI refreshes and switches to Receipts.
8. An audit record is created.

### 8.8 `/finance` — Finance and expense ledger

Visible/working features:

- Society fund, monthly collected amount, pending maintenance and recorded-expense totals.
- Society-specific income-versus-expense bar chart.
- Expense ledger.
- Add, edit and delete expense.
- Category, vendor, amount, date, bill filename and remarks.
- Excel export.
- Browser print.
- Audit entries for expense mutations.

Current limit:

- Bill upload is represented by a filename/default mock bill; no durable file storage service is connected.
- The income-versus-expense chart and older finance breakdown still use static society seed series, while the recorded-expenses total comes from live local expense records, so finance widgets can mix unrelated data sources.

### 8.9 `/reports` — Reports and exports

Selectors:

- Month
- Year

Available report datasets:

- Monthly collection report
- Outstanding invoice report
- Expense report
- Member report
- Audit report
- Annual collection report

Working actions:

- Excel export.
- CSV export.
- Print/PDF through browser print.
- Preview of monthly collection rows.

Report content includes receipt/invoice references, resident/flat, amounts, dates, payment mode, UTR/bank, outstanding data, expense data and audit actor information depending on report type.

### 8.10 `/notices` — Notice management

Visible/working features:

- Society-scoped notice list.
- Pinned badge and published date.
- Expand/collapse longer notice bodies.
- Publish-notice modal.
- Required title and message validation.
- Optional “Pin to top”.
- Pin/unpin and delete actions.
- Empty state.
- Audit logging through the service.

Notices created here persist in this browser’s localStorage. They do not currently synchronize to the separate mobile mock database.

### 8.11 `/events` — Event management

Visible/working features:

- Society-scoped event cards.
- Upcoming, Ongoing and Completed status.
- Date range, location, description, budget and RSVP count.
- Create, edit and delete.
- Title/location validation.
- Empty state.
- Audit logging through the service.

### 8.12 `/visitors` — Visitor log

Visible/working features:

- Society-scoped visitor entries.
- Name, status, flat, purpose, phone, vehicle and expected time.
- Delete/remove action.
- Empty state explaining that entries come from the connected external app.

Current behavior:

- There is no working gate-app connection yet.
- The page reads seeded/local browser data.
- It does not currently provide the earlier approve/reject/OTP/QR workflow.
- The visitor service can create records, but the current admin page exposes only list and delete.

### 8.13 `/settings` — Admin settings

Tabs:

1. Society & billing
2. Maintenance rules
3. WhatsApp log
4. Audit log
5. Integrations

Working society/billing settings:

- Society name and address.
- Logo fallback text.
- PNG/JPG/WebP logo upload with validation/compression.
- Remove/replace society logo.
- Registration and PAN information.
- Bank, account, IFSC and UPI details.
- Invoice and receipt prefixes.
- Settings update existing invoice branding.
- Society registry name/address are synchronized.

Working maintenance settings:

- Maintenance amount and charge breakdown.
- Late fee and due-day behavior.
- Municipal, administration, sinking fund, building maintenance, parking and non-occupancy values.
- Notes used on invoices.

Logs:

- WhatsApp simulation history.
- Society-scoped audit history with actor and timestamp.

Integrations:

- Integration configuration is UI/demo-level only.
- Razorpay, production WhatsApp, SMS and email delivery are not connected.

### 8.14 `/complaints` — Paused module

- The route exists but is intentionally hidden from active navigation.
- It shows “Complaints paused”.
- The only action sends the admin to the Collection Desk.
- Complaint creation, assignment, tracking and resident complaint screens are not implemented.

### 8.15 `/invoice/[invoiceNo]` — Public web invoice

- Does not require the society-admin dashboard session.
- Loads an invoice by invoice number from the current browser’s localStorage.
- Displays the formatted invoice document.
- Provides browser print/PDF behavior.
- Includes a demo Pay Now flow backed by the local payment service.
- A shared public link only works in browsers that already have the same localStorage data; another device normally shows “Invoice not found.”
- The route is public only in the browser demo; production must use secure, expiring links or authenticated authorization.

### 8.16 `/receipt/[receiptNo]` — Public web receipt

- Does not require the society-admin dashboard session.
- Loads and displays the formatted receipt from the current browser’s localStorage.
- Supports browser print/PDF.
- Opening a receipt currently writes an audit event in the local demo.
- Production must not expose sequential receipt data without secure authorization.

---

## 9. Core business logic already implemented

### Invoice calculations

- Maintenance items and arrears/adjustment items.
- Deduction support.
- Maintenance subtotal, arrears subtotal and total.
- Late fee, previous outstanding and advance.
- Paid amount and outstanding.
- Pending, Partial, Paid, Overdue and Cancelled statuses.
- Society-specific invoice number prefix.
- Duplicate prevention during monthly generation.
- Apply payment and recalculate status.
- Society-brand synchronization after settings changes.

### Payments and receipts

- Full and partial payments.
- Amount cannot exceed outstanding.
- Society-specific receipt prefix.
- Generated UTR/reference.
- Payment mode, bank, collector, date and month stored on receipt.
- Invoice is updated before the receipt response is shown.
- Collection statistics aggregate invoice and receipt state.

### Society settings

- Separate settings per society.
- Uploaded logo or fallback initials.
- Registration/PAN and payment destination.
- Maintenance charge components.
- Due day and late fee rules.
- Invoice and receipt prefixes.

### Audit and communication simulation

- Member, invoice, payment, expense, settings, notice, event and society actions can create audit records.
- WhatsApp invoice/reminder/receipt messages and links can be previewed and logged.
- Actual WhatsApp delivery is not connected.

### Formatting

- Mobile currency uses Indian `en-IN` formatting.
- Mobile dates display as `DD-MM-YYYY`.
- Invoice/receipt totals can be converted to Indian currency words.

---

## 10. Data models

**Source of truth for production:** `api/prisma/schema.prisma` (see section 13).

Backend domain types are in `backend/src/types/index.ts`. Mobile DTOs are in `frontend/src/api/types.ts`. They are intentionally similar but not generated from one shared package yet. The Nest Prisma schema is the durable multi-tenant model (societies, users, flats, members, invoices, payments, receipts, notices, events, visitors, complaints, documents, expenses, audit/notification logs, webhook events).

The central billing domain includes:

- `Society`
- `Member`
- `AuthUser`
- `SocietySettings`
- `Invoice`
- `InvoiceLineItem`
- `Receipt`
- `Expense`
- `SocietyNotice`
- `SocietyEvent`
- `SocietyVisitor`
- `AuditLog`
- `WhatsAppLog`

Important invoice fields:

- Society/member identity
- Month/year
- Issue/due dates
- Maintenance and arrears items
- Subtotals, late fee, previous outstanding and advance
- Total, paid and outstanding
- Status and cancellation timestamp

Important receipt fields:

- Society, invoice and receipt identity
- Resident/flat
- Amount, late fee and total paid
- Date and payment mode
- UTR, bank and collector

---

## 11. Mobile mock API behavior

The mock adapter mirrors the typed calls the Expo app uses. Prefer the Nest API (section 13) when `EXPO_PUBLIC_API_BASE_URL` is set.

Supported mock calls:

- Login and token refresh.
- Current user.
- Society settings.
- Dashboard summary.
- List and retrieve invoices.
- Apply payment.
- List and retrieve receipts.
- List and retrieve notices.
- List and retrieve events.
- List visitors.

The mock database:

- Seeds all three societies.
- Creates resident accounts from seeded members.
- Creates one admin account per society.
- Generates society-scoped invoices, receipts, notices, events and visitors.
- Resolves access/refresh mock tokens.
- Filters resident billing data to the authenticated resident.
- Filters admin data to the authenticated admin’s society.
- Mutates in memory during the current application session.

Current mock persistence limitation:

- Mobile mock payments/data reset when the JavaScript process reloads because the mock database is in memory.
- Authentication tokens persist, but mock business mutations are not a durable database.

---

## 12. Loading, errors, empty states and performance

### Mobile

- Dashboard and document/list pages use skeleton placeholders.
- Query failures show human-readable messages and retry actions.
- Empty invoices, receipts, notices, events and visitors have contextual empty states.
- Lists support pull-to-refresh.
- Payments/receipts use virtualized `FlatList` rendering.
- Filters are memoized and update immediately.
- Search fields include clear controls.
- Axios timeouts produce a specific timeout message.
- Network failures produce a server-reachability message.

### Web admin

- Authentication waits for client hydration to avoid extension-induced hydration mismatch.
- Protected layouts use loading gates/guards.
- Tables support responsive horizontal scrolling.
- Mutations use inline errors, confirmation dialogs and short success messages.
- Empty notices, events, visitors and reports display fallback copy.
- Page transitions and animated counters/charts provide visual feedback.

---

## 13. Production NestJS API (`api/`)

The NestJS service under `api/` is the production backend. Prefix: **`/api/v1`**. Interactive docs: **`/docs`**.

### Stack and layout

```text
api/
├── prisma/                 schema.prisma + seed.ts
├── supabase/migrations/    RLS policies SQL
├── src/
│   ├── common/             guards, filters, decorators, tenant/decimal utils
│   ├── config/             Zod env validation (postgresql:// required)
│   ├── infrastructure/     Prisma, Supabase Storage, Razorpay, PDF, BullMQ
│   └── modules/            Auth, Societies, Members, Flats, Billing, Payments,
│                           Receipts, Notifications, Documents, Visitors,
│                           Complaints, Reports, Audit, Settings, Community
```

`AppModule` imports Config, Throttler, Prisma, Supabase, Razorpay, PDF, Queue, Auth and all domain modules.

### Auth and tenancy

| Concern | Implementation |
| --- | --- |
| Login | `POST /auth/login` → access + refresh JWT, bcrypt passwords |
| Refresh / logout | `POST /auth/refresh`, `POST /auth/logout` |
| Current user | `GET /me` and `GET /auth/me` |
| Roles | `SUPER_ADMIN`, `SOCIETY_ADMIN`, `RESIDENT` via `@Roles` + `RolesGuard` |
| Tenant scope | JWT `societyId` / `memberId`; SUPER_ADMIN may pass `?societyId=` |
| Public routes | `@Public()` (login, refresh, Razorpay webhook) |

### Implemented HTTP surface (under `/api/v1`)

```text
POST   /auth/login | /auth/refresh | /auth/logout
GET    /auth/me | /me

GET|POST|PATCH|DELETE  /societies  (super-admin; GET /societies/me for admin)
GET|POST|PATCH|DELETE  /members
GET|POST|PATCH|DELETE  /flats
GET|PATCH              /society/settings

GET    /invoices?status=&month=
POST   /invoices/generate-monthly
GET    /invoices/:invoiceNo

POST   /payments/orders          # create Razorpay order + Payment CREATED
POST   /webhooks/razorpay        # public; signature on raw body → settle

GET    /receipts
GET    /receipts/:receiptNo

GET|POST  /notices | /notices/:id
GET|POST  /events  | /events/:id
GET       /dashboard

GET|POST|DELETE  /visitors
GET|POST|PATCH   /complaints  (+ PATCH /complaints/:id/status)
GET|POST         /documents   (+ POST /documents/register)
GET              /notifications
GET              /reports/collection | /reports/outstanding
GET              /audit-logs
```

### Payment settlement (do not trust the client)

1. Client: `POST /payments/orders` with `{ invoiceNo, amount? }`.
2. Client completes Razorpay Checkout (order id / key from response).
3. Razorpay → `POST /webhooks/razorpay` with signature.
4. API verifies HMAC against **raw body**, then in a Prisma transaction:
   - Idempotent `WebhookEvent` / `razorpayPaymentId`
   - `Payment` → `CAPTURED`
   - Invoice paid / outstanding / status
   - Create `Receipt` + `AuditLog`
5. After commit: BullMQ PDF → Supabase Storage URLs, WhatsApp/email notification jobs.

Mobile mock still uses `POST /payments` for immediate local settlement. Live clients must switch to orders + webhook/poll.

### Prisma domain models

`Society`, `User`, `RefreshToken`, `Flat`, `Member`, `SocietySettings`, `Invoice`, `Payment`, `Receipt`, `Notice`, `SocietyEvent`, `Visitor`, `Complaint`, `Document`, `Expense`, `AuditLog`, `NotificationLog`, `WebhookEvent` — every business table includes `societyId` where applicable.

### Env essentials (`api/.env`)

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Session pooler `postgresql://postgres.<ref>:…@aws-….pooler.supabase.com:5432/postgres?sslmode=require` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 chars |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` | Storage / server |
| `RAZORPAY_*` | Placeholders boot the API; real keys needed for live payments |
| `REDIS_*` | BullMQ |

### Mobile contract alignment

Endpoints the Expo client already expects (`/auth/login`, `/me`, `/dashboard`, `/invoices`, `/receipts`, `/notices`, `/events`, `/visitors`, `/society/settings`) exist on Nest. Remaining client work:

- Point `EXPO_PUBLIC_API_BASE_URL` at the API.
- Replace mock `POST /payments` with `POST /payments/orders` + wait for webhook settlement.
- Optionally call `/me` on session restore.
- Rewire Next.js `backend/` services to the same API (not done yet).

---

## 14. Features requested earlier but not built yet

The repository still does **not** ship 40+ complete production *UI* pages. Status vs earlier wishlist:

### Done on the Nest API (still thin or missing in mobile/web UI)

- Postgres / Supabase schema + Prisma.
- JWT auth, password hashing, refresh tokens.
- Server REST under `/api/v1` + Swagger.
- Tenant scoping + RLS SQL migration.
- Razorpay order + webhook settlement + idempotency hooks.
- BullMQ workers (billing, reminders, PDF, notification stubs).
- Complaints and documents **API** modules.
- Audit log API; Supabase Storage for PDF URLs.

### Still not built (product / clients)

**Authentication/onboarding (UI)**

- Splash beyond Expo splash, onboarding, resident self-registration, OTP, forgot password, biometric login.

**Resident/community modules (UI / deep product)**

- Full complaints UX in mobile/web (API exists; web route still paused).
- Amenities/booking, maid/driver, expected visitors + approval, delivery tracking.
- Family members, vehicles/parking UI.
- Rich document repository UX (NOC, share certificate, minutes).
- Push notifications and preference screens.
- Privacy / security / help-center pages.

**Payments/integrations (remaining)**

- Live Razorpay keys + mobile Checkout wiring.
- Refunds, chargebacks, failed-payment recovery UI.
- Production WhatsApp / SMS / email providers (queues log/stub today).

**Platform / clients**

- Rewire Next.js admin from localStorage → Nest API.
- Shared OpenAPI-generated types across apps.
- Real gate hardware integration, realtime fan-out, offline sync.
- Production analytics/monitoring and automated tenant-isolation tests.
- Server-side pagination/search on all list endpoints (partial / to harden).

---

## 15. Known issues and production risks

1. **Web admin is still not the real backend.** It remains a client-side localStorage demo until rewired to `api/`.
2. **Three data stores:** Nest Postgres, web localStorage, mobile mock — mutations do not sync.
3. **Web authentication is demo-only** (client-visible credentials/session). Nest uses bcrypt + JWT.
4. **Mobile mock resets** on full JS reload; Nest data is durable in Supabase.
5. **Mobile payment path is still simulated** until Checkout + `/payments/orders` + webhook polling ship.
6. **Razorpay / Redis / SMTP** must be configured for full payment and worker behavior; placeholders allow API boot.
7. **Public web invoice/receipt URLs** in the Next demo still need production auth or signed links.
8. **List pagination** is incomplete across some Nest list endpoints vs large-society needs.
9. **Types are duplicated** across `api`, `backend`, and `frontend` (no shared generated client yet).
10. **Some README wording is stale** (older indigo `#6D5DF6`); mobile UI is lime/ink (`#D6F252` / `#131417`).
11. **Home pull-to-refresh** refetches dashboard only; detail screens lack pull-to-refresh.
12. **Repository layout:** no root package/Git; only `frontend/` is a Git repo; keep secrets in `api/.env` (gitignored).
13. **Backend ESLint** on the Next app still fails (hooks/set-state-in-effect and related).
14. **`backend/docs/APP_GUIDE.md` is partially stale**; prefer this file + `api/README.md`.
15. **Direct Supabase host** (`db.<ref>.supabase.co`) may be IPv6-only / unresolved on some networks — prefer Session pooler.
16. **Prisma client import paths** mix `@prisma/client` and relative `generated/prisma` in places; build currently succeeds but should be unified.

---

## 16. Recommended next implementation order

### Phase 1 — Done (API foundation)

- [x] Postgres/Supabase schema with `societyId`
- [x] JWT auth + RBAC
- [x] RLS SQL + server-side tenant scoping
- [x] Core REST modules + mobile-aligned community routes
- [x] Env validation, Swagger, throttling

### Phase 2 — Mostly done on API; finish clients

1. Wire Expo pay flow to Razorpay Orders + webhook settlement.
2. Point mobile (and later admin) at `EXPO_PUBLIC_API_BASE_URL` / Nest base URL.
3. Seed remaining societies (Sunrise, Lakeview) in Prisma if needed for parity.
4. Harden pagination, search and signed PDF URLs.
5. Generate shared OpenAPI/TypeScript clients.

### Phase 3 — Scale and reliability

1. Dedicated BullMQ worker processes and Redis in every environment.
2. Push notifications and real email/WhatsApp providers.
3. Monitoring, error reporting, audit retention, backups.
4. Automated unit, integration, tenant-isolation and e2e tests.
5. Offline cache strategy for the mobile app.

### Phase 4 — Remaining product modules (UI)

1. Complaints UX (API ready).
2. Amenities/bookings, documents UX, family/vehicles/parking.
3. Staff/maid/driver and gate approval workflows.
4. Notification/security/help settings.
5. Retire or rewrite Next.js localStorage admin against Nest.

---

## 17. Recent updates (through 20 July 2026)

**API / platform**

- New `api/` NestJS application with Prisma → Supabase, JWT RBAC, Swagger, Zod.
- Domain modules for societies through settings + global AuditModule.
- Payments: Razorpay orders + webhook-only transactional settlement.
- BullMQ processors for billing, reminders, PDF, notifications.
- RLS migration SQL; seed for Green Valley admin/resident/super-admin.
- `AppModule` restored to include Config, Payments, Queue, Community and infra (after a domain-agent overwrite that briefly dropped them).
- Env validation requires real `postgresql://` URLs and accepts Supabase secret key aliases.
- Session pooler verified for the linked SocietyOne Supabase project.

**Mobile / web (prior)**

- Lime/ink theme, role-aware Pay vs Record Payment, Payments/Collections redesign.
- Invoice/receipt filters, search, virtualized lists, query cache isolation.
- Multi-society mock seed integrity; collection vs checkout terminology in web admin.

---

## 18. Verification status

**API**

```bash
cd api
npm run build
```

Build succeeds with the full production `AppModule`. Database connectivity was verified against the Supabase Session pooler using `pg`. Run migrate + seed before relying on seeded logins.

**Frontend** (prior UI work)

```bash
cd frontend
npx tsc --noEmit
npx expo lint
```

This document describes implemented code and labels mock, paused, UI-only and unfinished client wiring. Update it whenever API routes, schema or client integrations change.

Related docs:

- [`README.md`](./README.md) — top-level layout
- [`api/README.md`](./api/README.md) — API ops and payment pipeline
- `backend/README.md`, `backend/docs/APP_GUIDE.md` — legacy admin (partially stale)
- `frontend/README.md` — Expo app

