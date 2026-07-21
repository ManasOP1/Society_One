# SocietyOne — structure & deploy map

## What each folder is

```
SocietyOne/
│
├── api/                 ← BACKEND SERVER
│   ├── src/             NestJS modules (auth, billing, payments, members…)
│   ├── prisma/          Database schema
│   ├── supabase/        SQL migrations / enterprise SQL
│   └── package.json     name: societyone-api
│
├── admin/               ← WEB ADMIN (browser)
│   ├── src/app/         Next.js pages (login, members, invoices, settings…)
│   ├── src/services/    Calls Nest API
│   └── package.json     name: societyone-admin
│
└── mobile/              ← PHONE APP (residents)
    ├── src/app/         Expo Router screens
    ├── src/api/         HTTP client → Nest API
    └── package.json     name: societyone-mobile
```

## Old name → new name

| Old (confusing) | New (clear) | Meaning |
|-----------------|-------------|---------|
| `api/` | **`api/`** (unchanged) | NestJS backend API |
| `backend/` | **`admin/`** | Society admin website |
| `frontend/` | **`mobile/`** | Resident mobile app |

## Who talks to whom

```
┌─────────────┐     HTTPS      ┌──────────────────┐
│  admin/     │ ─────────────► │                  │
│  (Vercel)   │                │     api/         │
└─────────────┘                │  (Render)        │────► Supabase Postgres
                               │                  │────► Razorpay
┌─────────────┐     HTTPS      │                  │────► Redis (queues)
│  mobile/    │ ─────────────► │                  │
│  (phone)    │                └──────────────────┘
└─────────────┘
```

- **`api` does not render UI** — only JSON REST (`/api/v1/...`).
- **`admin` does not hold business DB logic** — it calls `api`.
- **`mobile` does not hold business DB logic** — it calls `api`.
- **Razorpay** is **off by default** (`RAZORPAY_ENABLED=false`). Admins can still record cash/cheque. Turn on after deploy with real keys.

## Deploy checklist

1. **`api` → Render**  
   - Root Directory: `api`  
   - Build: `npm install && npx prisma generate && npm run build`  
   - Start: `npm run start:prod`

2. **`admin` → Vercel**  
   - Import admin repo or monorepo with Root Directory `admin`  
   - Env: `NEXT_PUBLIC_API_BASE_URL=https://<render-host>/api/v1`

3. **`mobile` → EAS / APK**  
   - Work from `mobile/`  
   - Env: `EXPO_PUBLIC_API_BASE_URL=https://<render-host>/api/v1`  
   - `eas build` or `npx expo run:android`

## Local ports

| App | Command | URL |
|-----|---------|-----|
| API | `cd api && npm run start:dev` | http://localhost:4000/api/v1 |
| Admin | `cd admin && npm run dev` | http://localhost:3000 |
| Mobile | `cd mobile && npm start` | Expo :8081 |
