# SocietyOne Admin

Next.js **society admin web console**.

- Talks to NestJS API in `../api` (local) or your Render URL (production).
- Deploy to **Vercel** (this folder is also published as [Society_One_Web](https://github.com/ManasOP1/Society_One_Web)).

```bash
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000/login
```

See root [`STRUCTURE.md`](../STRUCTURE.md) for how `api` / `admin` / `mobile` fit together.
