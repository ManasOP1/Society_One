# SocietyOne

Multi-tenant apartment / society management platform.

## Project structure

```
SocietyOne/
├── api/       NestJS REST API + Prisma + Supabase Postgres + Razorpay
├── admin/     Next.js society admin web console
├── mobile/    Expo React Native resident app (Android / iOS)
├── README.md  ← you are here
└── STRUCTURE.md
```

| Folder | What it is | Who uses it | Deploy where |
|--------|------------|-------------|--------------|
| **`api/`** | Backend server (NestJS) | Admin + Mobile call this | **[Render](https://render.com)** Web Service |
| **`admin/`** | Web dashboard (Next.js) | Society admins in browser | **[Vercel](https://vercel.com)** |
| **`mobile/`** | Phone app (Expo) | Residents on Android/iOS | **EAS / Play Store / APK** |

> Naming note: older folders were `backend` (admin UI) and `frontend` (mobile). Those names were confusing — **`admin`** and **`mobile`** are the current names.

---

## Local development

### 1. API (required for real data)

```bash
cd api
cp .env.example .env   # DATABASE_URL, JWT, Supabase, Razorpay, Redis
npm install
npx prisma generate
npm run start:dev      # http://localhost:4000/api/v1  · Swagger /docs
```

### 2. Admin web console

```bash
cd admin
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000/login
```

`.env.local` should use same-origin proxy in dev:

```env
NEXT_PUBLIC_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://localhost:4000
```

### 3. Mobile app

```bash
cd mobile
cp .env.example .env
npm install
npm start              # Expo :8081
```

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:4000/api/v1
```

---

## Deploy via Git

| App | GitHub repo (example) | Host | Root directory |
|-----|----------------------|------|----------------|
| API | `Society_One` (monorepo) or API-only | Render | `api` |
| Admin | `Society_One_Web` | Vercel | repo root (admin only) **or** `admin` in monorepo |
| Mobile | monorepo `mobile/` | EAS Build | `mobile` |

**Production env examples**

- Render (`api`): full `api/.env` secrets + `CORS_ORIGINS=https://your-admin.vercel.app`
- Vercel (`admin`): `NEXT_PUBLIC_API_BASE_URL=https://your-api.onrender.com/api/v1`
- Mobile: `EXPO_PUBLIC_API_BASE_URL=https://your-api.onrender.com/api/v1`

---

## Seed / demo logins

| Role | Login | Password |
|------|--------|----------|
| Society admin (web) | `admin@greenvalley.in` | `admin123` |
| Resident (mobile) | society + wing + flat + password | (from seed / admin) |

See [`STRUCTURE.md`](./STRUCTURE.md) for a one-page map of folders and responsibilities.
