# SocietyOne Mobile

Expo (React Native + TypeScript) **resident phone app**.

Lives in folder `mobile/` (formerly `frontend/`). Talks to NestJS `api/` — not to the admin website.

## Run

```bash
npm install
cp .env.example .env
npm start          # Expo → press a (Android), i (iOS), w (web)
```

## API connection

The app talks to the SocietyOne **API** (`../api`) through a typed client
(`src/api/client.ts`, axios + TanStack Query).

- Set the server URL in `.env`:

  ```
  EXPO_PUBLIC_API_BASE_URL=https://your-api.example.com
  ```

- Leave it **empty** to run in **demo mode**: an in-app mock backend
  (`src/api/mock/`) serves the identical REST contract with seeded data.

Demo accounts (mock mode):

| Role     | Email                    | Password    |
| -------- | ------------------------ | ----------- |
| Resident | resident@greenvalley.in  | resident123 |
| Admin    | admin@greenvalley.in     | admin123    |

### REST contract the backend must expose

```
POST /auth/login       { email, password }        → { accessToken, refreshToken, user }
POST /auth/refresh     { refreshToken }           → { accessToken, refreshToken }
GET  /me                                          → AuthUser
GET  /society/settings                            → SocietySettings (name, address, logo, bank/UPI, prefixes, charges)
GET  /dashboard                                   → DashboardSummary
GET  /invoices?status=&month=                     → Invoice[]
GET  /invoices/:invoiceNo                         → Invoice
POST /payments         { invoiceNo, amount, mode }→ { success, receipt, invoice, utr }
GET  /receipts                                    → Receipt[]
GET  /receipts/:receiptNo                         → Receipt
GET  /notices, /notices/:id                       → SocietyNotice[] / SocietyNotice
GET  /events,  /events/:id                        → SocietyEvent[] / SocietyEvent
GET  /visitors                                    → SocietyVisitor[]
```

All types live in `src/api/types.ts` (mirrors `admin/src/types/index.ts`).
See root [`STRUCTURE.md`](../STRUCTURE.md) for the full monorepo map.
Every record is scoped server-side to the authenticated user's society.

## Auth

- Access/refresh tokens stored in **expo-secure-store** (localStorage on web).
- Every request carries `Authorization: Bearer <accessToken>`.
- On **401** the client refreshes the token once (single-flight) and retries;
  if refresh fails the user is signed out.

## Structure

```
src/
├── api/          client, typed endpoints, token store, mock backend
├── app/          expo-router routes
│   ├── (tabs)/   Home · Bills · Visitors · Community · Profile
│   ├── invoice/  [invoiceNo] full maintenance bill + share PDF
│   ├── receipt/  [receiptNo] receipt + share PDF
│   ├── pay/      [invoiceNo] payment flow → success receipt
│   ├── notice/   [id] · event/[id]
│   └── login.tsx
├── components/   design system (Button, Card, Badge, Skeleton, states, …)
├── constants/    theme tokens (colors, spacing, radius, fonts)
├── context/      auth provider
├── hooks/        TanStack Query hooks, theme hooks
└── utils/        INR/date formatting, amount-in-words, invoice/receipt PDF
```

## Conventions

- Amounts formatted en-IN (`₹12,34,567`), dates as `DD-MM-YYYY`.
- Pull-to-refresh on all list/dashboard screens; skeletons while loading;
  empty and error states with retry everywhere.
- PDFs generated with `expo-print` and shared with `expo-sharing`
  (print dialog on web).
