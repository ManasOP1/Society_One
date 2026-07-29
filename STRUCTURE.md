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
│   ├── src/app/         Next.js pages (login, members, invoices, visitors…)
│   ├── public/          Static assets (favicon.png)
│   ├── src/services/    Calls Nest API
│   └── package.json     name: societyone-admin
│
├── mobile/              ← PHONE APP (residents)
│   ├── src/app/         Expo Router screens
│   ├── assets/          App icons, splash, images
│   ├── src/api/         HTTP client → Nest API
│   └── package.json     name: societyone-mobile
│
└── AppIcons/            ← Source icon pack (appicon.co)
    ├── android/         Adaptive / mipmap launchers
    ├── AppIcon.icon/    iOS Liquid Glass / Expo iOS icon
    ├── Assets.xcassets/ Xcode asset catalog
    ├── appstore.png
    └── playstore.png
```

## GitHub repos (respective remotes)

| Remote | Repo | Contents | Deploy |
|--------|------|----------|--------|
| `origin` | [Society_One](https://github.com/ManasOP1/Society_One) | Full monorepo (`api` + `admin` + `mobile` + `AppIcons`) | Render root dir: `api` |
| `society-web` | [Society_One_Web](https://github.com/ManasOP1/Society_One_Web) | **Admin only at repo root** | Vercel Root Directory: empty / `.` |

Push workflow from this workspace:

```bash
# Monorepo (API + mobile + admin source of truth)
git push origin main

# Admin web only → Vercel-friendly repo (contents of admin/ at root)
git subtree push --prefix=admin society-web main
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
- **Razorpay** is **off by default** (`RAZORPAY_ENABLED=false`).

## Deploy checklist

1. **`api` → Render** (`Society_One`, Root Directory: `api`)
   - Build: `npm install --include=dev && npx prisma generate && npm run build`
   - Start: `npm run start:prod`
   - Env: `ADMIN_PUBLIC_URL=https://societyoneadmin-one.vercel.app`
   - Env: `CORS_ORIGINS=https://societyoneadmin-one.vercel.app`

2. **`admin` → Vercel** (`Society_One_Web`, Root Directory empty)
   - Env: `NEXT_PUBLIC_API_BASE_URL=/api/v1`
   - Env: `API_PROXY_TARGET=https://admin-society-one.onrender.com`

3. **`mobile` → EAS / APK**
   - Work from `mobile/`
   - Icons: wired from `AppIcons/` into `mobile/assets/`
   - Env: `EXPO_PUBLIC_API_BASE_URL=https://admin-society-one.onrender.com/api/v1`
   - `eas build --platform android --profile preview`

## Local ports

| App | Command | URL |
|-----|---------|-----|
| API | `cd api && npm run start:dev` | http://localhost:4000/api/v1 |
| Admin | `cd admin && npm run dev` | http://localhost:3000 |
| Mobile | `cd mobile && npm start` | Expo :8081 |
