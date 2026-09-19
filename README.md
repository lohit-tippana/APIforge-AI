# APIForge AI

**AI-powered API development, testing & collaboration platform** — a production-grade developer SaaS combining an API client (Postman-style), an assertion-based testing engine with a collection runner, generated documentation, team workspaces with RBAC, and an AI assistant.

**Live demo:** https://organisations-contents-essex-publisher.trycloudflare.com — sign in with `demo@apiforge.dev` / `demo1234`.

## Features

- **API client** — full request builder: methods, params, headers, auth (Bearer / Basic / API key), JSON / form-data / urlencoded / raw bodies, `{{env}}` interpolation
- **Response viewer** — status / timing / size, collapsible JSON tree, headers, cookies, copy & download
- **Collections** — folders, nesting, rename / duplicate / delete / reorder, filter
- **Environments** — per-project variable sets; secrets never leave the server
- **Testing** — assertion engine (status, response time, JSON path/type/equals, headers, body, JSON schema) + sequential collection runner with per-assertion results
- **AI assistant** — generate requests from English, generate assertions from responses, explain errors, generate docs / schemas / mocks. Provider abstraction: OpenAI-compatible API or built-in heuristic engine (works offline, labeled in UI)
- **Workspaces & teams** — roles (Owner / Admin / Developer / Viewer) enforced server-side, invites, activity feed, notifications
- **Request history**, **analytics dashboard**, **⌘K command palette**, **generated API docs**
- **Security** — scrypt password hashing, httpOnly JWT access + rotating refresh cookies, CSRF guard, rate limiting, zod validation, helmet, API keys (`afk_…`), secret masking

## Architecture

```
apps/
  web/    Next.js (App Router, React 19, Tailwind v4, Radix, TanStack Query, CodeMirror, Recharts)
  api/    Express + TypeScript (modular controllers/services, Prisma, Socket.IO, undici executor)
```

- Browser → Next.js `/api/*` → rewritten to Express (`:4000`). Cookies stay first-party; no CORS in dev.
- HTTP requests are executed **server-side** by the API (undici) — no browser CORS limits, real timing/size capture.
- Realtime test-run progress over Socket.IO (cookie-authenticated).
- Cache abstraction: Redis (`REDIS_URL`) with in-memory fallback.

## Database

Prisma schema: `apps/api/prisma/schema.prisma` — users, refresh tokens, workspaces, members, invites, projects, collections, folders, requests (+ headers / params / assertions), environments (+ variables), test runs / results, history, docs, notifications, activity log, API keys, AI conversations.

> **Dev note:** the local environment runs **MySQL 8**. The schema avoids vendor-specific types, so a PostgreSQL port is a provider-line change + regenerated migrations (Postgres was the original spec target; this machine has no Docker/Postgres).

## Local setup

Requirements: Node 20+, a MySQL 8 instance.

```bash
# 1. Database — create user + db (adjust to your MySQL root creds)
mysql -u root -p -e "CREATE USER 'apiforge'@'localhost' IDENTIFIED BY 'apiforge_dev'; \
  CREATE DATABASE apiforge; GRANT ALL ON apiforge.* TO 'apiforge'@'localhost'; FLUSH PRIVILEGES;"

# 2. API env
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL, JWT secrets, optional OPENAI_API_KEY

# 3. Install + migrate + seed
npm install --prefix apps/api
npm run db:migrate -w apps/api
npm run db:seed -w apps/api

# 4. Web deps
npm install --prefix apps/web

# 5. Run both (or run each separately)
npm run dev          # api :4000 + web :3000
```

Open http://localhost:3000 — demo login `demo@apiforge.dev / demo1234` (seeded workspace "Acme Engineering" pointing at the DummyJSON sandbox, so requests/tests genuinely execute).

## Environment variables

See `.env.example` (root) and `apps/api/.env.example`. Key ones:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma datasource (`mysql://…`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | token signing (required in prod) |
| `REDIS_URL` | optional — enables Redis cache |
| `AI_PROVIDER` | `openai` or `local` |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | any OpenAI-compatible endpoint |
| `NEXT_PUBLIC_SOCKET_URL` | web → socket target (default `http://localhost:4000`) |

## Testing

```bash
npm run test -w apps/api    # vitest: assertions engine, interpolation, local AI engine
```

## Docker

```bash
docker compose up --build   # mysql + redis + api (migrations run on boot)
# then run apps/web separately, or extend compose with the web service
```

## API surface (app's own REST API)

`/api/auth` · `/api/workspaces` · `/api/projects` · `/api/collections` · `/api/folders` · `/api/requests` · `/api/environments` · `/api/execute` · `/api/test-runs` · `/api/ai/*` · `/api/docs` · `/api/notifications` · `/api/users/me/*` · search/activity/analytics under workspaces & projects.

## Known limitations

- Dev DB is MySQL (Postgres documented above); Redis optional in dev.
- Invite emails generate a shareable link rather than sending SMTP mail.
- Request reordering API exists; tree drag-and-drop UI is not implemented.
