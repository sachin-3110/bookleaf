# BookLeaf — Author Support Portal

A full-stack support & communication portal for a self-publishing company, built for the
BookLeaf technical assignment. Authors sign in to see their catalogue and royalty position and
raise support queries; the ops team gets a single queue with AI-assisted triage, priority
classification, suggested replies, and a complete audit trail.

- **Live:** _<add Vercel URL here>_
- **API reference:** `/api-docs` (Swagger UI) · raw spec at [`public/openapi.yaml`](public/openapi.yaml)
- **Postman:** [`docs/postman/bookleaf.postman_collection.json`](docs/postman/bookleaf.postman_collection.json)

---

## 1. Test credentials

The seed creates one admin and one login per author, all sharing the same password.

| Role | Email | Password |
|---|---|---|
| Admin (ops) | `admin@bookleaf.test` | `bookleaf123` |
| Author | `priya.sharma@email.com` (any of the 10 author emails) | `bookleaf123` |

Author emails all follow `<first>.<last>@email.com` and come straight from the provided
`bookleaf_sample_data.json` (e.g. `rohit.kapoor@email.com`, `ananya.reddy@email.com`).

> Override the shared password by setting `SEED_PASSWORD` before running the seed.

---

## 2. What it does

**Author portal**

- **My Books** — every title with status, publication details, print partner, sales and the
  royalty breakdown (earned / paid / pending). Books still in production render cleanly with
  `—` placeholders and are excluded from the dashboard totals.
- **My Tickets** — a polling list of the author's queries with status, priority, category and an
  "Awaiting response" / "Team has replied" signal.
- **Submit a query** — a short form (book, subject, description, optional attachment metadata).
  The author never picks a category or a priority; those are assigned by the system.
- **Ticket detail** — the full thread with the ops team; replying to a resolved ticket reopens it.

**Admin console**

- **Queue** — filter by status, category, priority, assignment and free-text search, sorted by
  **urgency** by default (Critical first, then oldest) so the most urgent *and* oldest unresolved
  tickets surface at the top.
- **Ticket detail** — the conversation, an AI panel (classification + a suggested reply draft),
  triage controls (status, category, priority, assign-to-me), public replies vs. internal notes,
  and a complete activity/audit trail.
- **Stats** — ticket counts by status, category and priority.

---

## 3. Tech stack & why

| Choice | Why |
|---|---|
| **Next.js 16 (App Router, TS)** | One deployable for UI + REST API. Route Handlers give a real, documented REST surface; no separate Express service to host, version or CORS. |
| **MongoDB + Mongoose** | The provided data is nested JSON (authors → books); documents map naturally. Embedded `messages`/`events` keep a ticket's thread and audit trail in a single read. |
| **Zod** | One schema drives request validation, TypeScript types **and** the OpenAPI spec — the contract can't drift from the code. |
| **Custom JWT in an httpOnly cookie (`jose`)** | Sessions are stateless (no session store), the token is unreadable to client JS (XSS-resistant), and identity is derived from the token — never trusted from the request body. |
| **SWR polling (~10 s)** | Near-real-time without WebSocket infrastructure. A support inbox changes on human timescales; polling is the right cost/benefit call here. |
| **Tailwind CSS 4** | Design tokens live in CSS (`@theme`), so the UI stays consistent and there is no runtime CSS-in-JS cost. |
| **OpenRouter (OpenAI-compatible)** | One integration, many models, a genuine free tier. Wrapped behind a provider interface so the model is a config value, not a code change. |

---

## 4. Architecture

```
Request ─► route.ts ──► *.service.ts ──► models/ ──► MongoDB
             │              │
        validation      business rules
        + guard         + DTO shaping
```

- **`src/app/api/**/route.ts`** — HTTP only: parse, validate with Zod, call a service, shape the
  response. Routes never touch Mongoose.
- **`src/server/services/*.service.ts`** — business logic and DTO mapping. Services never touch
  `NextResponse`.
- **`src/server/models/*`** — Mongoose schemas and indexes.
- **`src/server/http/*`** — the cross-cutting HTTP contract: `ApiError`, `respond` (success/error
  envelopes), `request` (JSON parsing), `rateLimit`.
- **`src/server/middleware/guard.ts`** — `requireUser` / `requireRole`, reading the session cookie.
- **`src/shared/*`** — constants, types and Zod schemas shared by server and client, so the
  frontend and the API can never disagree about shapes.

```
src/
├─ app/
│  ├─ (auth)/login/            # public sign-in
│  ├─ (author)/                # books, tickets, tickets/new, tickets/[id]
│  ├─ (admin)/admin/           # queue, admin/tickets/[id], admin/stats
│  ├─ api-docs/                # Swagger UI
│  └─ api/                     # REST route handlers (see §6)
├─ components/                 # app shell + shared UI primitives
├─ lib/                        # typed fetch client, endpoint wrappers, SWR hooks, formatters
├─ server/
│  ├─ ai/                      # provider interface, OpenRouter provider, prompts, rules fallback
│  ├─ auth/  config/  db/      # jwt+session, env, cached connection
│  ├─ http/  middleware/       # error/response helpers, guards
│  ├─ models/  services/
└─ shared/                     # constants, types, zod schemas
```

**Request flow example — raise a query**
`POST /api/me/tickets` → guard resolves the author from the cookie → Zod validates the body →
service checks the book belongs to the author → AI classifies category + priority (rule fallback
if AI is off or slow) → ticket is stored with an atomic `TK-####` id and a `created` audit event →
`201` with the ticket. AI can never block ticket creation.

---

## 5. Getting started

```bash
# 1. Install
npm install

# 2. Configure — copy the example and fill in real values
cp .env.example .env.local

# 3. Seed the provided dataset (10 authors / 18 books) + demo logins
npm run seed          # idempotent upsert
# npm run seed:fresh  # wipe first, then seed

# 4. Run
npm run dev           # http://localhost:3000
```

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB Atlas free M0 (or a local `mongod`). |
| `JWT_SECRET` | yes | Long random string (≥16 chars) — signs the session cookie. |
| `JWT_EXPIRES_IN` | no | Session lifetime, default `7d`. |
| `APP_URL` | no | Public base URL, used in docs/links. |
| `OPENROUTER_API_KEY` | no | Enables real AI. Empty ⇒ deterministic rule-based fallback. |
| `OPENROUTER_MODEL` | no | Any OpenRouter model id; the `:free` suffix targets the free tier. |
| `OPENROUTER_BASE_URL` | no | Defaults to `https://openrouter.ai/api/v1`. |
| `AI_ENABLED` | no | `false` forces the rule-based path (useful for offline demos). |

**All secrets are server-only.** Nothing sensitive is prefixed `NEXT_PUBLIC_`, so nothing reaches
the client bundle.

---

## 6. API reference

Base path `/api`. JSON in, JSON out. Auth is a **httpOnly session cookie** set by
`POST /api/auth/login` — there is no bearer token to copy around; your browser (or Postman's
cookie jar) carries it automatically.

- **Success:** `{ "data": <payload>, "meta"?: { page, limit, total } }`
- **Error:** `{ "error": { "code": "...", "message": "...", "details"?: [...] } }`

### Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Sign in; sets `bookleaf_session` cookie. |
| POST | `/api/auth/logout` | any | Clear the session (idempotent). |
| GET | `/api/auth/me` | any | Current user (re-checked against the DB). |
| GET | `/api/me/books` | author | Own books + royalty totals (published only). |
| GET | `/api/me/tickets` | author | Own tickets. `?page&limit&status` |
| POST | `/api/me/tickets` | author | Create a query → auto-classified. |
| GET | `/api/me/tickets/{ticketId}` | author | One owned ticket (404 if not yours). |
| POST | `/api/me/tickets/{ticketId}/messages` | author | Follow-up; reopens a resolved ticket. |
| GET | `/api/admin/tickets` | admin | Queue. `?status&category&priority&assignedTo&q&sort&page&limit` |
| GET | `/api/admin/tickets/{ticketId}` | admin | Detail + internal notes + events + **AI draft**. |
| PATCH | `/api/admin/tickets/{ticketId}` | admin | Triage: `status`, `category`, `priority`, `assignSelf`. |
| POST | `/api/admin/tickets/{ticketId}/messages` | admin | Reply (`public`) or note (`internal`). |
| POST | `/api/admin/tickets/{ticketId}/ai` | admin | `{mode:'draft'\|'classify'}` — (re)run AI. |
| GET | `/api/admin/stats` | admin | Counts by status / category / priority. |
| GET | `/openapi.yaml` | public | The OpenAPI 3.1 spec. |

### Example calls

```bash
# Sign in (the cookie jar saves the session for later calls)
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@bookleaf.test","password":"bookleaf123"}'
```

```bash
# Author: raise a query — 201, classified automatically
curl -b cookies.txt -X POST http://localhost:3000/api/me/tickets \
  -H 'Content-Type: application/json' \
  -d '{"book_id":"BK001","subject":"Royalty not received",
       "description":"I published four months ago and have not received any royalty yet."}'
```

```bash
# Admin: the queue, most urgent + oldest first
curl -b cookies.txt 'http://localhost:3000/api/admin/tickets?status=Open&sort=urgency&limit=20'
```

```bash
# Admin: triage — override priority, take ownership
curl -b cookies.txt -X PATCH http://localhost:3000/api/admin/tickets/TK-1001 \
  -H 'Content-Type: application/json' \
  -d '{"priority":"Critical","assignSelf":true}'

# Admin: reply to the author
curl -b cookies.txt -X POST http://localhost:3000/api/admin/tickets/TK-1001/messages \
  -H 'Content-Type: application/json' \
  -d '{"body":"Hi Priya, your payout is scheduled for this Friday.","visibility":"public"}'
```

### Status codes & error codes

| HTTP | Meaning |
|---|---|
| 200 | OK |
| 201 | Created (ticket, message) |
| 400 | Validation failed |
| 401 | Not authenticated / bad credentials |
| 403 | Authenticated but not allowed (e.g. author on `/admin/*`) |
| 404 | Not found — **or not visible to you** (we never leak existence) |
| 409 | Conflict (e.g. invalid status transition) |
| 429 | Rate limited (login / AI) |
| 500 | Unexpected server error |

Error `code` values: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `FORBIDDEN`,
`NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `AI_UNAVAILABLE`, `INTERNAL_ERROR`.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [{ "path": "subject", "message": "String must contain at least 3 character(s)" }]
  }
}
```

---

## 7. AI strategy

Three jobs, all **advisory and overridable**:

1. **Classify category** (6 categories from the BookLeaf knowledge base).
2. **Set priority** (Critical / High / Medium / Low).
3. **Draft a reply** for the ops team (lazily, only when a ticket is opened — drafts cost tokens,
   so we don't generate them for tickets nobody looks at).

**Design decisions**

- **Provider-agnostic.** `AIProvider` is an interface; OpenRouter is one implementation. Swapping
  models is a config change. Any OpenAI-compatible gateway drops in.
- **Structured output.** The model returns JSON which is validated with Zod before use — a
  malformed reply degrades to the fallback, never corrupts a record.
- **Never blocks the user.** Ticket creation always succeeds. If AI is disabled, slow (8 s
  timeout) or rate-limited, a deterministic **rule-based fallback** (keyword → category, heuristic
  → priority, template → draft) takes over and the ticket still lands.
- **Overridable with a trace.** When an admin changes a classification, the AI's original guess is
  preserved in `aiOriginal` and an audit event records the change — so "why is this Critical?" has
  an answer.
- **Cost-aware.** One combined classify+priority call per ticket; drafts are cached on the ticket
  and only regenerated on demand.

---

## 8. Real-time: polling, not sockets

Lists refresh every ~10 s with SWR. A support inbox is not a chat app — human replies arrive on
minute timescales, so the cost of WebSockets/SSE (connection management, server state, serverless
compatibility) isn't justified. Polling is trivial to reason about, works on serverless, and
revalidates on focus. If latency ever mattered, SSE would be the next step, not sockets.

---

## 9. Known limitations & next steps

- **Attachments are metadata only** (name/size/type) — no binary storage in this scope. Next step:
  signed direct-to-object-store uploads.
- **No instant revocation.** A JWT is valid until it expires; a production build would add a
  short-lived access token + refresh rotation, or a server-side denylist.
- **Search is regex-based**, fine for this dataset; production would use MongoDB Atlas Search.
- **No email notifications** on reply — an author finds out by polling the portal.
- **Single-tenant roles** (`author` / `admin`); a real system would add per-team scoping and
  granular permissions.
- **Rate limiting is in-memory**, suitable for one instance; a multi-instance deploy would move it
  to Redis.

---

## 10. Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server (Turbopack). |
| `npm run build` / `npm start` | Production build / serve. |
| `npm run seed` | Idempotent seed of the provided dataset + demo logins. |
| `npm run seed:fresh` | Wipe collections, then seed from scratch. |
| `npm run lint` | ESLint. |
