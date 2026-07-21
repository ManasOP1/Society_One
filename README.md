# SocietyOne

Multi-tenant apartment/society management platform.

```
SocietyOne/
├── api/        NestJS production API (Postgres + Razorpay + BullMQ)
├── backend/    Next.js society-admin web console (legacy localStorage demo)
└── frontend/   Expo resident/admin mobile app
```

## Production API (`api/`)

```bash
cd api
cp .env.example .env   # set DATABASE_URL, JWT, Supabase, Razorpay, Redis
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev      # http://localhost:4000/api/v1  · docs at /docs
```

See [`api/README.md`](./api/README.md) for architecture, webhook payment flow, RLS, and seed accounts.

## Admin web console (`backend/`)

Legacy Next.js demo admin (browser localStorage). Keep for UI reference until it is rewired to `api/`.

```bash
cd backend
npm install
npm run dev     # http://localhost:3000/login
```

## Mobile app (`frontend/`)

```bash
cd frontend
npm install
npm start       # Expo on :8081
```

Set `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1` in `frontend/.env` to talk to the NestJS API (leave empty for the built-in mock).
