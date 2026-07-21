# SocietyOne — Application Guide

Complete documentation of what was built, how authentication works, and what every menu / page does.

---

## 1. Overview

**SocietyOne** is a multi-society apartment management SaaS admin panel.

| Item | Detail |
|------|--------|
| Brand | SocietyOne |
| Stack | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Charts | Recharts |
| Icons | [AnimateIcons Lucide](https://animateicons.in/icons/lucide) (animated sidebar) + Lucide React |
| Forms | React Hook Form |
| Tables | TanStack Table |
| Excel | `xlsx` (import / export) |
| Auth (demo) | Client-side society login with `localStorage` |

---

## 2. How to Run

```bash
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

You will be redirected to **`/login`** if not signed in.

### Demo login

| Society | Admin email | Password |
|---------|-------------|----------|
| Green Valley Residency | `admin@greenvalley.in` | `admin123` |
| Sunrise Heights | `admin@sunriseheights.in` | `admin123` |
| Lakeview Apartments | `admin@lakeview.in` | `admin123` |

After login you **only see data for that society** (members, invoices, payments, reports, finance).

---

## Platform architecture (backend vs resident app)

Keep this model in mind as we grow:

| Layer | Role | Today | Later |
|-------|------|-------|-------|
| **Super Admin** (`/super-admin`) | Create & manage all societies | localStorage registry | Write to DB / admin API |
| **Society Admin** (this dashboard) | Ops for **one** society | localStorage services | Society-scoped APIs |
| **Resident app** (separate frontend) | Pay bills, notices, visitors | Public invoice/receipt pages | Mobile/web app → same APIs |

### Super Admin (demo)

| Field | Value |
|-------|--------|
| URL | `/super-admin/login` |
| Email | `superadmin@societyone.app` |
| Password | `superadmin123` |

Create society → appears in society login picker → society admin can sign in.

Service: `src/services/society.service.ts` (swap methods for real backend later).

---

## Local data architecture (no backend)

All operational data is stored in **localStorage** behind service modules so a real API can replace them later without UI changes.

| Service | Storage key | Purpose |
|---------|-------------|---------|
| `invoice.service` | `societyone-invoices-v1` | Generate / status / duplicate invoices |
| `payment.service` + `receiptService` | `societyone-receipts-v1` | Mock Pay Now + receipts |
| `expense.service` | `societyone-expenses-v1` | Finance expense CRUD |
| `settings.service` | `societyone-settings-v1` | Society, bank, prefixes, rules |
| `audit.service` | `societyone-audit-v1` | Action trail |
| `whatsapp.service` | `societyone-whatsapp-v1` | Simulated reminders |

### Public pages (no login)

| Path | Description |
|------|-------------|
| `/invoice/INV-YYYY-MM-0001` | Public invoice + mock Pay Now |
| `/receipt/REC-YYYY-MM-0001` | Public receipt + PDF print |

### Invoice module (`/invoices`)

- Generate monthly invoices (`INV-2026-07-0001` style)
- Preview, duplicate, delete, mark Paid / Partial / Pending / Cancelled
- Send Reminder (WhatsApp mock preview)
- Collection stats: expected, collected, outstanding, %, pending, late, today's collection
- Download PDF via browser print

### Payments (`/payments`)

**Collection desk** for admins (not a resident checkout):

- Progress hero + outstanding / collected / today / attention KPIs
- Tabs: **Dues** · **Receipts** · **All invoices**
- **Record payment** modal (full/partial, UPI/Cash/Bank/Card/Cheque) → receipt
- Billing documents stay on **Invoices**

### Complaints

Hidden from sidebar / FAB / dashboard. Route `/complaints` shows a paused notice.


### Expenses

Managed under **Finance** — CRUD, categories, mock bill upload, Excel export.

### Settings

Society name, logo text, bank, invoice/receipt prefixes, maintenance rules → localStorage. **Audit Logs** and **WhatsApp (Mock)** tabs included.

---

## 3. Project Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── invoice/[invoiceNo]/      # Public invoice
│   ├── receipt/[receiptNo]/      # Public receipt
│   └── (dashboard)/
│       ├── invoices/page.tsx
│       ├── finance/page.tsx       # + expenses
│       ├── payments/page.tsx
│       ├── members/page.tsx
│       ├── reports/page.tsx
│       └── settings/page.tsx      # + audit / WhatsApp mock
├── services/                      # Swap these for API later
├── hooks/useInvoices.ts
├── types/index.ts
├── lib/storage.ts
└── components/invoices/           # Invoice + receipt documents
```

---

## 4. Authentication & Society Isolation

### Flow

1. User opens app → `AuthGuard` checks session.
2. No session → redirect to `/login`.
3. On login: select **Society Name**, enter email + password.
4. Session saved in `localStorage` key `societyone-session`.
5. Dashboard and all modules filter data by `societyId`.

### What is scoped per society

- Total members / flats / fund / pending maintenance
- Members table (create / import only into this society)
- Payment records (monthly / annual filters)
- Finance chart series
- Report Excel / CSV export rows

You cannot see another society’s dashboard while logged into one society.

### Logout

Sidebar footer → **Logout** → clears session → back to `/login`.

---

## 5. Side Menu (every item)

The top navbar was removed. Navigation is a **left sidebar**.

### Behaviour

| Mode | Behaviour |
|------|-----------|
| Desktop | Collapsed icon rail (~72px). Hover rail → expands (~256px) with labels. Leave → collapses. Content padding animates so cards are not covered. |
| Mobile / Tablet (<1024px) | Top bar with hamburger. Sidebar is a drawer overlay. |
| Icons | AnimateIcons Lucide — animate on **menu row hover** via `startAnimation()` / `stopAnimation()`. |

### Menu map

| Menu | Route | Icon | What it does |
|------|-------|------|--------------|
| **Dashboard** | `/` | Dashboard | Society home: welcome, stats cards (members/flats, collected, pending, fund), featured event, calendar, monthly collection vs expense chart, members ratio, raised tickets, building snapshot. |
| **Finance** | `/finance` | Wallet | Society fund, collected this month, pending maintenance, late fees. Bar chart income vs expense. Breakdown list. PDF / Excel / Print action buttons (UI). |
| **Events** | `/events` | Clipboard | Create / view society events (cards with date, location, RSVP, budget, gallery actions). |
| **Members** | `/members` | Users | Member directory for **this building only**. Searchable table (photo, wing, flat, owner, tenant, phone, email, parking, maintenance status). **Add Member** form. **Import Excel** + download template. **Export** Excel. |
| **Complaints** | `/complaints` | — | **Hidden** from nav (paused). Route shows notice only. |
| **Notices** | `/notices` | Bell | Publish / list society notices with date and read-more. |
| **Invoices** | `/invoices` | Badge $ | Generate billing docs, status, reminders, PDF. |
| **Payments** | `/payments` | Credit card | **Collection desk**: dues queue, record payment (full/partial), receipt ledger. |
| **Visitors** | `/visitors` | User check | Visitor entry, history, approve/reject, QR / OTP verification UI, vehicle number, expected time. |
| **Reports** | `/reports` | Chart bar | Generate / export collection reports. Month & year selectors. Excel + CSV download in the **required receipt format** (see §7). Preview table of columns. |
| **Settings** | `/settings` | Gear | Admin settings tabs: Society details, Committee, Maintenance rules, Razorpay gateway, SMS, WhatsApp API, Email, Roles & permissions. |
| **Logout** | — | Log out | Ends session for the current society admin. |

### Floating Action Button (FAB)

Bottom-right `+` opens quick links:

- Add Member → `/members`
- Generate Invoice → `/invoices`
- Record Payment → `/payments`
- Create Notice → `/notices`
- Add Event → `/events`
- Export Report → `/reports`

---

## 6. Dashboard Widgets (detail)

| Widget | Purpose |
|--------|---------|
| Members / Flats card | Total members + occupied/total flats → links to Members |
| Collected this month | Sum of paid maintenance + late fee note → Payments |
| Pending maintenance | Outstanding dues → Payments |
| Society fund | Total corpus balance → Finance |
| Featured event | Carousel of upcoming events (e.g. Diwali) |
| Calendar | Interactive month calendar, Today jump, event dots |
| Monthly collection analysis | Line/area chart: collection vs expense (society-specific series) |
| Members Ratio | Donut by age groups |
| Raised Tickets | Latest complaints shortcuts |
| Building snapshot | Quick counts + link to Reports |

---

## 7. Reports — Export Column Format

Exports (Excel / CSV) use this exact column order:

1. Receipt No  
2. Invoice No  
3. Month  
4. Flat No  
5. Wing  
6. Owner Name  
7. Mobile  
8. Maintenance Amount  
9. Due Date  
10. Paid Amount  
11. Payment Date  
12. Payment Mode  
13. UTR / Transaction ID  
14. Bank  
15. Late Fee  
16. Total Paid  
17. Outstanding  
18. Status  
19. Collected By  

Defined in `src/data/societies.ts` as `REPORT_COLUMNS` + `paymentToReportRow()`.

Report types on the page:

- Monthly Collection Report  
- Annual Collection Report  
- Expense Report  
- Audit Report  
- Collection Summary  

---

## 8. Members — Create & Excel Import

### Form fields

Wing, Flat, Owner, Tenant, Phone, Email, Parking, Maintenance status.

### Excel template columns

`Wing | Flat | Owner | Tenant | Phone | Email | Parking | Maintenance`

Imported rows are attached to the **logged-in society** only and stored in `localStorage` (`societyone-members`).

---

## 9. Payments — Filters & Metrics

| Control | Effect |
|---------|--------|
| Monthly | Filter by `YYYY-MM` |
| Annual | Filter by year |
| Collected | Sum of paid / partial totals |
| Outstanding | Sum of unpaid balances |
| Late payment fees | Sum of late fees |
| Pending flats | Count of pending / outstanding rows |

---

## 10. Responsive Design

| Breakpoint | Layout |
|------------|--------|
| Mobile | Top bar + drawer sidebar, stacked cards, scrollable tables |
| Tablet | 2-column stats / widgets |
| Desktop | Icon sidebar, hover expand, 4-column stats, chart + side panels |

All pages wrap content with `min-w-0` / `overflow-x-hidden` to avoid horizontal shake and clipped cards.

---

## 11. Societies Seeded in Demo

### Green Valley Residency

- Wings A–D, 150 flats, 128 occupied, 153 members  
- Larger payment sample set for reports  

### Sunrise Heights

- Wings A–C, 90 flats  

### Lakeview Apartments

- Wings East / West, 60 flats  

---

## 12. Known Demo Limits

- Auth is front-end only (not production-secure).  
- Razorpay / WhatsApp / SMS / Email settings are UI placeholders.  
- PDF print buttons are present; Excel/CSV export is implemented for reports & members.  
- Complaints / events / visitors use shared mock lists (not fully per-society yet).  

---

## 13. Key Files for Future Backend Wiring

| Concern | File |
|---------|------|
| Societies & payments schema | `src/data/societies.ts` |
| Session / import members | `src/context/auth-context.tsx` |
| Sidebar UX | `src/components/layout/sidebar.tsx`, `sidebar-nav-item.tsx` |
| Report export | `src/app/(dashboard)/reports/page.tsx` |
| Member CRUD + Excel | `src/app/(dashboard)/members/page.tsx` |

When moving to Supabase / Prisma / Razorpay, keep the same routes and replace mock filters with `society_id` queries and RLS.
