# Deploying APIForge AI

Two services + one database. Recommended: **Vercel** (web) + **Railway** (API + MySQL). ~10 minutes, free tiers.

## 1. Push to GitHub

Repo root contains `apps/web` and `apps/api`. Push `main` to your GitHub repo (empty repo, no README).

## 2. Railway — API + MySQL

1. https://railway.com → **New Project → Deploy from GitHub repo** → pick `apiforge-ai`.
2. Set **Root Directory** to `apps/api` (service settings → Source).
3. **Add → Database → MySQL** in the same project.
4. In the API service → **Variables**:
   | Var | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (Railway variable reference) |
   | `JWT_ACCESS_SECRET` | any long random string |
   | `JWT_REFRESH_SECRET` | another long random string |
   | `WEB_ORIGIN` | `https://<your-app>.vercel.app` (set after step 3, then redeploy) |
   | `AI_PROVIDER` | `local` — or `openai` with `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` |
   | `NODE_ENV` | `production` |
5. Deploy. The `railway.json` runs `prisma migrate deploy` then `node dist/index.js`. Grab the public URL under **Settings → Networking → Generate Domain** (e.g. `apiforge-api.up.railway.app`).
6. Optional seed: Railway shell → `npm run db:seed`.

## 3. Vercel — web

1. https://vercel.com → **Add New → Project** → import the repo.
2. **Root Directory** = `apps/web` (Edit on the import screen).
3. **Environment Variables**:
   | Var | Value |
   | --- | --- |
   | `API_ORIGIN` | `https://<your-api>.up.railway.app` |
   | `NEXT_PUBLIC_SOCKET_URL` | same URL |
4. Deploy. All `/api/*` calls are rewritten server-side to the API — cookies stay first-party, no CORS.

## 4. Verify

- `https://<app>.vercel.app/api/health` → `{"ok":true,"service":"apiforge-api"}`
- Register → onboarding → create project → send a request.
- Socket.IO authenticates via `/api/auth/socket-token` (httpOnly cookies aren't readable by JS).

## Notes

- `AI_PROVIDER=local` needs no keys; set `openai` + `OPENAI_API_KEY` for a real LLM.
- Redis is optional (`REDIS_URL`); the API falls back to in-memory cache.
- Local dev DB is MySQL; Railway's managed MySQL is the production path. To use Postgres instead, change the Prisma provider + `DATABASE_URL` and regenerate migrations.
