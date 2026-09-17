# BHARATPURE — Master Operating Manual
> SIH 2026 · PS 26033 · Ministry of Consumer Affairs, Food & Public Distribution (DoCA)
> Stack: PERN · PWA · AI Decision Engine · WhatsApp Bot
> Read every line before touching a file. No exceptions.

---

## READ THIS FIRST — 4-Step Ritual Before Any Code

1. **Identify your module** — which file, which route, which component?
2. **Read the existing file completely** — never overwrite what you haven't read
3. **Ask only on real conflicts** — schema change, API contract change, auth logic = stop and escalate. Anything else = proceed.
4. **Do the task and report** — what you built, what needs wiring next, what the acceptance check result was.

Subagent tasks ship with a concrete acceptance check (curl, newman run, or Postman assertion).  
Never mark a task DONE without running that check against the live server.

---

## PRODUCT CONTEXT

BharatPure is not a marketplace. It is an **AI-powered trust and decision infrastructure** for India's farm-to-market network.

**Four pillars (name these when explaining the product):**

1. **Decision Engine** — AI predicts demand, computes fair prices from verified quality, matches FPO supply to buyer demand, optimizes vehicle routing.
2. **Trust Layer** — Every batch has an immutable Batch Identity Record (BIR) built on Event Sourcing. NABL lab certificates, IoT cold-chain logs, and cryptographic QR codes make every transaction verifiable.
3. **Open Commerce** — ONDC-compatible Seller Network Participant adapter. FPOs list on BharatPure; any ONDC buyer app can discover. Government rails (AgriStack, eNAM, ONDC) are consumed, not replaced.
4. **Accessible Interface** — PWA for farmers/consumers/logistics (works offline, installable on phone). Web portal for government/admin. WhatsApp bot for farmers who won't open an app.

**Glossary:**
- **BIR** — Batch Identity Record. Append-only event log per batch. Never updated; only appended.
- **FPO** — Farmer Producer Organisation. Legal entity through which farmers transact (APMC compliant).
- **Cluster** — 15–40 farmers growing the same crop in the same geographic region.
- **IEI** — Intermediation Efficiency Index. Before/after comparison of farmer realization, consumer price, logistics distance, settlement time.
- **Event Sourcing** — Architecture pattern where state is derived from an immutable event log, not from mutable rows.
- **QR Burn** — Consumer invalidates a batch's QR code on opening the package. Permanently flags the code as consumed in the BIR. Prevents bag-refill fraud.
- **Escrow Engine** — Consumer payment held until DeliveredToConsumer event fires. Auto-released. No manual intervention.
- **AgriStack** — India's federated digital agriculture infrastructure (Farmer IDs, crop sown registry). BharatPure uses authorized mock in prototype; federated consent model applies.
- **eNAM** — National Agriculture Market. BharatPure consumes eNAM price data as input to Price Intelligence. Does not compete with or replace eNAM.
- **ONDC SNP** — Open Network for Digital Commerce, Seller Network Participant. BharatPure registers as SNP; FPO listings become discoverable on buyer apps.
- **DPI** — Digital Public Infrastructure. The government stack (AgriStack + eNAM + ONDC + UPI) on which BharatPure sits as an intelligence layer.
- **Verified Premium** — Price uplift from having a NABL-certified quality score. A 94/100 turmeric batch commands ₹182–197/kg vs ₹140 commodity rate.
- **Forward Market** — Pre-sowing procurement agreements between BharatPure and FPOs, sized against demand forecasts. eNAM is spot market only.

---

## ARCHITECTURE AT A GLANCE

```
monorepo/
├── backend/          # Node.js + Express + PostgreSQL
├── frontend/         # React 18 + Vite + TypeScript (PWA + Web)
├── ai/               # Python FastAPI — Decision Engine microservice
├── docs/
│   ├── research/
│   ├── testing/
│   └── screenshots/
├── BHARATPURE-CLAUDE.md   (this file)
├── BHARATPURE-DB.md
├── BHARATPURE-API.md
├── BHARATPURE-UI.md
├── BHARATPURE-AI.md
├── chatbot.md
├── README.md
├── PITCH.md
└── .mcp.json
```

### Stack (non-negotiable)

**Backend:**
- Runtime: Node.js 20 LTS
- Framework: Express 4
- Database: PostgreSQL 16 via `node-pg` (raw parameterized SQL) + `node-pg-migrate`
- Auth: `jsonwebtoken` + `bcrypt` — own the logic, own the middleware
- Validation: `zod` (shared schema between backend validation and frontend types)
- Logging: `pino` + `pino-http`
- File uploads: `multer` (for NABL certificate PDF uploads)
- QR generation: `qrcode` library
- Scheduling: `node-cron` (for demand forecast refresh)
- WhatsApp: Twilio sandbox (WhatsApp Business API)
- SMS/OTP: Log to console in dev; `devOtp` field in response — never block demo on provider

**AI Microservice (separate process, called by backend):**
- Runtime: Python 3.11
- Framework: FastAPI
- ML: `lightgbm`, `prophet`, `xgboost`
- Routing: `ortools` (Google OR-Tools, VRP solver)
- Geo: `osmnx`, OSRM API (for road distances)
- Served at: `http://localhost:8000` in dev

**Frontend:**
- React 18 + Vite + TypeScript
- TanStack Query v5 (all server state)
- Zustand (global client state: auth, cart, active role)
- React Hook Form + Zod (all forms)
- shadcn/ui + Tailwind CSS (component base)
- React Leaflet + Leaflet (maps — route visualization, farm location)
- Recharts (all charts — demand forecast, IEI, price intelligence)
- `vite-plugin-pwa` + Workbox (PWA — service worker, offline support, manifest)
- `react-qr-reader` (QR scanner for consumer app)
- React Router v6

**PWA Targets (installable, offline-capable):**
- Farmer/FPO portal — mobile-first PWA
- Consumer portal — mobile-first PWA
- Logistics driver portal — mobile-first PWA

**Web-only (not PWA):**
- Bulk Buyer portal — responsive web
- Admin/Government portal — responsive web

---

## RBAC — FIVE ROLES

| Role | Code | Portal Type | Primary Device |
|---|---|---|---|
| Farmer / FPO Operator | `FARMER` | PWA | Android/iOS phone |
| Consumer | `CONSUMER` | PWA | Android/iOS phone |
| Bulk Buyer | `BULK_BUYER` | Web | Desktop / tablet |
| Logistics Driver | `LOGISTICS` | PWA | Android phone |
| Admin / Government | `ADMIN` | Web | Desktop |

Role is stored on the JWT payload and in the `users` table. Every protected route checks `req.user.role` against an allowedRoles array in middleware. Roles are assigned at registration — never changeable by the user after creation.

---

## AUTH SYSTEM — FULL SPECIFICATION

### Registration Flow (all roles)

1. User selects role on landing page.
2. Fills registration form (role-specific fields — see below).
3. Backend creates user with `status: 'pending'`.
4. OTP generated (6-digit numeric), stored hashed in `users.otp_hash`, expires in 10 minutes (`users.otp_expires_at`).
5. **Dev mode:** OTP logged via `pino.info` to console AND returned in response as `{ devOtp: "123456" }` field. Frontend displays it in a yellow dev-mode banner. Never block on an SMS provider.
6. User submits OTP → backend verifies hash, checks expiry, sets `status: 'active'`, clears OTP fields.
7. Backend issues: `accessToken` (JWT, 15min) + `refreshToken` (JWT, 7d, stored in HttpOnly cookie).
8. Frontend redirects to role-specific dashboard.

### Role-Specific Registration Fields

**FARMER:**
- Full name, phone (primary identifier), email (optional), state, district, FPO name/registration number, primary crop type, AgriStack Farmer ID (optional — mock validation only)

**CONSUMER:**
- Full name, phone, email, delivery pincode

**BULK_BUYER:**
- Company name, contact person name, phone, email, GSTIN, business type (restaurant chain / food processor / institution / other)

**LOGISTICS:**
- Full name, phone, vehicle type (dry van / cold van), vehicle registration number, base location (state, city)

**ADMIN:**
- Admin code (env-gated — must match `ADMIN_REGISTRATION_CODE` env var), name, email, phone, designation

### Login Flow

1. Identifier: phone number (all roles) OR email (BULK_BUYER, ADMIN).
2. Password submitted → bcrypt compare.
3. If `status: 'pending'` → return `403` with `{ code: 'OTP_REQUIRED' }` → frontend redirects to OTP screen.
4. If `status: 'suspended'` → return `403` with `{ code: 'ACCOUNT_SUSPENDED' }`.
5. Success → same token pair as registration.

### Forgot Password Flow

1. POST `/api/auth/forgot-password` with phone/email.
2. Generate OTP, store hashed, return `devOtp` same as registration.
3. POST `/api/auth/verify-reset-otp` → validate → return `resetToken` (short-lived, 5min JWT with purpose: 'password_reset').
4. POST `/api/auth/reset-password` with `resetToken` + new password → bcrypt hash → update.

### JWT Middleware

```js
// backend/middleware/auth.js
// verifyToken(req, res, next) — decodes accessToken from Authorization: Bearer header
// requireRoles(...roles) — checks req.user.role is in allowed list
// Usage: router.get('/route', verifyToken, requireRoles('ADMIN', 'FARMER'), controller)
```

Refresh: POST `/api/auth/refresh` reads HttpOnly cookie `refreshToken` → issues new `accessToken` in response body. Frontend TanStack Query interceptor calls this automatically on 401.

---

## BUILD PHASE ROADMAP

### Phase 0 — Foundation (do first, everything depends on this)
- [ ] `node-pg-migrate` setup, all migration files written and run
- [ ] Express app skeleton: error handler, pino logger, cors, helmet, rate limiter
- [ ] Auth routes: register, login, verify-otp, forgot-password, verify-reset-otp, reset-password, refresh, logout
- [ ] JWT middleware: verifyToken, requireRoles
- [ ] Vite + React + Tailwind + shadcn/ui initialized
- [ ] TanStack Query provider, Zustand auth store, axios client with interceptor
- [ ] React Router: role-based route guards
- [ ] Landing page (role selector + CTA)
- [ ] Auth screens: Register (all roles), Login, OTP, Forgot Password, Reset Password
- [ ] FastAPI AI service skeleton: health endpoint, three route stubs

**Phase 0 acceptance:** `newman run backend/postman/-collection.json` on auth routes passes. Login → dashboard redirect works for all 5 roles.

---

### Phase 1 — Farmer/FPO Core
- [ ] Farmer profile + cluster management
- [ ] Procurement contract (pre-sowing agreement) CRUD
- [ ] Batch creation wizard (3 steps: crop → quality info → pricing/listing)
- [ ] BIR creation on batch submit — first events: `BatchCreated`, `HarvestDataLogged`
- [ ] Quality test submission (tier 1 rapid / tier 2 NABL)
- [ ] NABL certificate PDF upload → S3/local storage → linked to BIR event `NABLCertificateLinked`
- [ ] Batch status state machine: `draft → pending_test → test_passed → listed → sold → delivered`
- [ ] Farmer dashboard: demand signal feed, batch status list, earnings summary
- [ ] FPO Trust Score computation (cron + manual trigger)

**CUT LINE — if behind at Phase 1 end:** FPO Trust Score deferred to mock data. Procurement contracts deferred to demo script only.

---

### Phase 2 — Decision Engine Integration
- [ ] Demand Intelligence API call → frontend demand dashboard (chart + drivers + confidence)
- [ ] Price Intelligence API call → batch listing price recommendation
- [ ] Route Optimization API call → logistics route plan + savings display
- [ ] Allocation Engine → shortage simulation (drop slider, reallocate)
- [ ] What-if Simulator UI (two sliders: demand spike + supply disruption → Decision Engine response)
- [ ] Intermediation Efficiency Index dashboard (before/after table with live data)
- [ ] Demand forecast refresh cron (every 6 hours)

**CUT LINE:** Satellite NDVI integration deferred to mock. eNAM live feed deferred to static JSON mock clearly labeled.

---

### Phase 3 — Marketplace + Orders
- [ ] Batch listing page (consumer/bulk buyer browse, filter by crop/quality/location)
- [ ] Batch detail page with full BIR display
- [ ] QR code generation per batch (cryptographic hash)
- [ ] Consumer: add to cart → order → escrow hold → payment confirmation
- [ ] Bulk buyer: bulk order form → volume pricing → institutional invoicing
- [ ] Order status transitions: `placed → confirmed → dispatched → delivered → settled`
- [ ] Escrow engine: hold on order create, release on `DeliveredToConsumer` BIR event

---

### Phase 4 — Logistics + Trust
- [ ] Logistics driver dashboard: assigned routes, pickup/delivery confirmation
- [ ] Route map (React Leaflet) with OR-Tools output displayed
- [ ] Temperature log entry → appended to BIR as `TempLogEvent`
- [ ] Temperature breach detection → `TemperatureBreachDetected` BIR event → alert
- [ ] QR scan + burn flow (consumer camera scan → BIR public view → burn confirmation)
- [ ] Dispute resolution flow (raise → BIR evidence → resolution)

---

### Phase 5 — Admin + DPI + Polish
- [ ] Admin dashboard: full IEI, demand charts, FPO/batch management
- [ ] DPI compatibility screen: AgriStack / eNAM / ONDC integration status (mock + sandbox)
- [ ] PWA manifest + service worker (offline support for farmer/consumer/logistics)
- [ ] WhatsApp bot: Twilio webhook → intent extraction via Claude API → Decision Engine APIs → Hindi/English response
- [ ] Seed data: 3 FPOs, 6 batches, 2 consumers, 1 bulk buyer, demand forecast data
- [ ] Demo rehearsal: full end-to-end transaction under 3 minutes
- [ ] Postman collection: full-flow newman run, log result to `docs/testing/`

---

## ENVIRONMENT VARIABLES

```bash
# backend/.env

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bharatpure_dev

# Auth
JWT_ACCESS_SECRET=change_me_access_secret_min_32chars
JWT_REFRESH_SECRET=change_me_refresh_secret_min_32chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ADMIN_REGISTRATION_CODE=sih2026admin

# AI Microservice
AI_SERVICE_URL=http://localhost:8000

# WhatsApp / Twilio
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
ANTHROPIC_API_KEY=your_claude_api_key

# File Storage (local dev)
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads

# eNAM Mock Feed (static JSON path)
ENAM_MOCK_DATA_PATH=./mocks/enam-prices.json

# App
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173

# frontend/.env
VITE_API_BASE_URL=http://localhost:5000
VITE_AI_SERVICE_URL=http://localhost:8000
VITE_TWILIO_WHATSAPP_NUMBER=+14155238886
VITE_MAPS_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png

# ai/.env
DATABASE_URL=postgresql://user:password@localhost:5432/bharatpure_dev
PORT=8000
ENAM_MOCK_PATH=../backend/mocks/enam-prices.json
```

---

## CLAUDE CODE — MANDATORY OPERATING MODE

Claude Code must operate in **plan-first mode** on every task. No exceptions.

### Before implementing anything:

1. **State your understanding** of the task in 3–5 sentences. What does this touch? What are the inputs and outputs? What can go wrong?
2. **List every file you will read before writing** — read them, don't assume their current state.
3. **Write your implementation plan** — ordered list of exact changes, with the reason for each decision.
4. **Identify edge cases** — at minimum 3 edge cases for any non-trivial task. State how each is handled.
5. **State the acceptance check** — exact curl command or newman assertion that proves it works.

Only after completing steps 1–5 should any code be written.

### Research protocol — mandatory before any of these:

| Situation | Required research |
|---|---|
| Using a new library or npm package | Check current version, check breaking changes, check known issues. Document in `docs/research/{library}.md`. |
| Implementing a business rule from the PS | Re-read the relevant section of BHARATPURE-CLAUDE.md and BHARATPURE-DB.md before writing any code. |
| Writing a SQL query for a new workflow | Write the query in isolation first, explain each clause, verify with EXPLAIN ANALYZE on test data. |
| Touching auth or security logic | Read the entire auth spec in this file before touching a single line. |
| Integrating AI microservice | Read BHARATPURE-AI.md fully, check the FastAPI endpoint spec, test the endpoint manually before wiring frontend. |
| Any route that involves money (escrow, payments) | Read the escrow atomic-write pattern in BHARATPURE-DB.md. Write the transaction SQL first. |

### Documentation mandate:

Every piece of research Claude Code performs must be written to a file under `docs/research/`. Format:

```
# Research: {Topic}
Date: YYYY-MM-DD
Task context: {which task triggered this}

## Question
{what was being investigated}

## Findings
{what was found — specific, not vague}

## Decision
{what was decided based on findings}

## Sources
{URLs or docs sections consulted}
```

A task that produces research but doesn't write this file is incomplete. The file is committed separately (`docs: research on {topic}`).

---

## TESTING STRATEGY

- Every route gets a Postman request in `backend/postman/-collection.json` as it ships.
- A `backend/postman/-environment.json` holds `baseUrl` + `authToken` variables. All requests use `{{baseUrl}}` and `{{authToken}}`.
- At end of each phase: `newman run backend/postman/-collection.json -e backend/postman/-environment.json --delay-request 650` — result logged to `docs/testing/phase-N-newman-YYYY-MM-DD.txt`. The `--delay-request` is required: the collection's ~116 requests otherwise outrun the global rate limiter (100 req/min, `app.js`) within its own run and produce false 429 failures that look like a regression but aren't — always check a failure is a genuine wrong-value assertion, not a cascaded 429, before treating it as a bug.
- The collection runs against the real dev database (`bharatpure_dev`) and really mutates it (batches change status, listings/orders/escrow rows get created) — there is no separate test database (the app DB role lacks `CREATEDB`). **Run `npm run db:reset` (in `backend/`) after any newman run or manual API testing** to truncate every table and re-seed clean demo data — never leave the dev DB in a test-polluted state before a demo. `npm run db:seed` alone is idempotent and safe to re-run any time (upserts, never duplicates) but does not undo mutations testing made to already-seeded rows, only `db:reset`'s truncate does that.
- Manual click-through before demo: written checklist in `docs/testing/demo-rehearsal.md`.

---

## GIT RULES

- Solo authorship. Never touch `git config`. No `Co-Authored-By` trailer. No AI attribution of any kind. All commits under the repo owner's name only.
- Remote: paste the real repo URL when you have it. Until then, no `git remote add`. Never guess a URL.
- Conventional commits: `feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`
- First commit: `chore: bootstrap project scaffold`

### HIGH COMMIT COUNT STRATEGY (critical for judge evaluation)

Judges evaluate commit history. A project with 150+ commits shows consistent, structured engineering. A project with 5 commits shows bulk-dumping. Every unit of work is its own commit. No exceptions.

**Commit granularity rules:**
- 1 migration file = 1 commit (`chore: add 003_create_batches migration`)
- 1 backend route handler = 1 commit (`feat: implement POST /api/batches`)
- 1 frontend page/component = 1 commit (`feat: add farmer batch create step 1 form`)
- 1 Postman test added = 1 commit (`test: add batch creation postman assertion`)
- 1 bug fix = 1 commit (`fix: handle null quality_score in price intelligence response`)
- 1 validation rule added = 1 commit (`feat: add phone number format validation on farmer register`)
- 1 type definition file = 1 commit (`chore: define BatchStatus and BIREvent TypeScript types`)
- Seed data = 1 commit (`chore: add seed data for 3 FPOs and 6 batches`)
- Docs update = 1 commit (`docs: add demand forecast research findings`)
- Every Postman newman run result = 1 commit (`test: phase 1 newman run — all 14 auth routes pass`)

**Target commit counts per phase:**
- Phase 0 (Foundation): 30–40 commits
- Phase 1 (Farmer Core): 25–35 commits
- Phase 2 (Decision Engine): 20–30 commits
- Phase 3 (Marketplace + Orders): 25–35 commits
- Phase 4 (Logistics + Trust): 20–25 commits
- Phase 5 (Admin + Polish + Demo): 15–20 commits
- **Total target: 135–185 commits minimum**

Never batch two independent changes into one commit to save time. The commit log is evidence of the engineering process.

---

## SUPERVISOR ↔ SUBAGENT OWNERSHIP

| Supervisor (Claude Code / you) | Subagent (Antigravity) |
|---|---|
| Schema design + all migrations | Implementation against written spec |
| API contract decisions | Boilerplate CRUD against written routes |
| Auth logic + JWT middleware | Repetitive UI components, seed data |
| Security-relevant code | Research tasks (output to docs/research/) |
| All git operations | Test data generation |
| Reviewing + verifying subagent output | Documentation drafts |

**Standing rules:**
- Schema/migrations are NEVER a subagent task.
- Every subagent task has an explicit file scope list. No two open tasks share files.
- If subagent hits a design decision → stop, write the question into the task, wait.
- Research tasks output to `docs/research/{topic}.md`. Never paste research into chatbot.md.

---

## DEFINITION OF DONE

A feature is not DONE until every row is true:

| Check | Requirement |
|---|---|
| API | Route → controller → service implemented |
| SQL | All queries parameterized. No `SELECT *`. `rows.length` checked before `rows[0]`. |
| Transactions | Multi-table writes in `BEGIN/COMMIT`. |
| Validation | Input validated in controller via Zod. Errors return proper status codes. |
| Error handling | All async controllers wrapped in try/catch → next(err). |
| Types | TypeScript types defined for all request/response shapes. |
| Postman | Request added to `-collection.json` and actually run against live server. |
| Loading state | Every async UI action has a loading indicator. |
| Empty state | Every list view has an empty state with a CTA. |
| Responsive | Mobile-first. PWA screens tested at 375px width. Web screens at 1280px. |
| Logged | `pino.info` on success. `pino.error` on failure with context. |
| Committed | Conventional commit message. Not staged and forgotten. |
| README/PITCH | Updated if the change is user-visible. |

---

## FOLDER STRUCTURE (create empty with .gitkeep)

```
backend/
├── src/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   ├── db/
│   │   ├── index.js          # node-pg pool
│   │   └── migrations/       # node-pg-migrate files
│   ├── utils/
│   └── app.js
├── postman/
│   ├── -collection.json
│   └── -environment.json
├── mocks/
│   └── enam-prices.json
└── uploads/

frontend/
├── src/
│   ├── api/
│   │   ├── client.ts         # axios instance + interceptor
│   │   ├── auth.api.ts
│   │   ├── farmer.api.ts
│   │   ├── batch.api.ts
│   │   ├── marketplace.api.ts
│   │   ├── order.api.ts
│   │   ├── logistics.api.ts
│   │   ├── demand.api.ts
│   │   ├── price.api.ts
│   │   ├── simulation.api.ts
│   │   └── admin.api.ts
│   ├── components/
│   │   ├── ui/               # shadcn/ui — NEVER edit directly
│   │   └── shared/           # named wrappers over shadcn/ui
│   ├── pages/
│   │   ├── auth/
│   │   ├── farmer/
│   │   ├── consumer/
│   │   ├── bulk-buyer/
│   │   ├── logistics/
│   │   └── admin/
│   ├── stores/
│   │   ├── auth.store.ts
│   │   └── cart.store.ts
│   ├── hooks/
│   ├── types/
│   ├── lib/
│   └── main.tsx
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/

ai/
├── main.py
├── routers/
│   ├── demand.py
│   ├── price.py
│   ├── routing.py
│   └── simulation.py
├── models/
│   ├── demand_model.py
│   ├── price_model.py
│   └── route_optimizer.py
├── data/
│   └── synthetic_training.csv
└── requirements.txt

docs/
├── research/
├── testing/
└── screenshots/
```

---

## PWA MANIFEST SPEC

Farmer, Consumer, and Logistics portals must be installable PWAs.

```json
// frontend/public/manifest.json
{
  "name": "BharatPure",
  "short_name": "BharatPure",
  "description": "India's farm-to-market trust network",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1B4332",
  "theme_color": "#1B4332",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

Service worker caches: auth pages, dashboard shell, static assets.  
Farmer interface must work offline for batch creation (queue locally, sync on reconnect).  
Consumer QR scan must work offline (cached BIR data for recently scanned batches).

---

## STATE MANAGEMENT RULES

| State Type | Tool |
|---|---|
| Server state (API data) | TanStack Query — always. Never Zustand for API responses. |
| Auth (user, token, role) | Zustand `auth.store.ts` — persisted to localStorage |
| Cart (consumer orders) | Zustand `cart.store.ts` — persisted to localStorage |
| Batch-create wizard draft | Zustand `batchDraft.store.ts` — persisted to sessionStorage (survives a refresh mid-wizard, doesn't outlive the tab) |
| Forms | React Hook Form + Zod — always |
| Ephemeral UI (modal open, tab active) | `useState` — never Zustand for this |
| Route state | React Router `useLocation` / `useSearchParams` |

**Anti-patterns (banned):**
- No API calls inside component bodies — all calls in `useQuery` / `useMutation` hooks
- No `localStorage` for anything that should be React state
- No inline styles — Tailwind classes only
- No direct shadcn/ui file edits — wrap in named components under `components/shared/`
- No `any` type in TypeScript

---

## SECURITY CHECKLIST (must pass before demo)

- [ ] All user input sanitized via Zod before hitting DB
- [ ] No `SELECT *` anywhere in codebase
- [ ] No raw string interpolation in SQL queries
- [ ] JWT secrets not hardcoded (env only)
- [ ] ADMIN_REGISTRATION_CODE gated in env
- [ ] File upload: MIME type check + size limit (NABL PDF max 5MB)
- [ ] Rate limiting on auth routes: 5 attempts / 15min per IP
- [ ] HttpOnly cookie for refresh token (no JS access)
- [ ] CORS restricted to `VITE_API_BASE_URL` origin in production
- [ ] QR hash is cryptographic (SHA-256 of batch_id + secret) — never sequential/guessable

---

## MOCK DATA REQUIRED (seed script)

Seed in `backend/src/db/seed.js`:

**FPOs (3):**
- Sangli Turmeric FPO (Maharashtra) — 22 farmers, turmeric
- Rajasthan Mustard Collective (Rajasthan) — 18 farmers, mustard
- Himachal Honey Producers (Himachal Pradesh) — 14 beekeepers, honey

**Batches (6):**
- MH-TUR-2026-014: turmeric, 2.5t, purity 94/100, NABL certified, status: listed, price ₹188/kg
- MH-TUR-2026-015: turmeric, 1.8t, purity 89/100, tier 1 passed, status: pending_test
- RJ-MUS-2026-003: mustard oil, 1.2t, purity 91/100, status: listed, price ₹142/kg
- HP-HON-2026-007: honey, 0.8t, NMR passed, purity 97/100, status: listed, price ₹380/kg
- MH-TUR-2026-016: turmeric, 0.9t, REJECTED (lead above limit), public rejection logged
- RJ-MUS-2026-004: mustard oil, 2.0t, status: delivered, sold to bulk buyer

**Users:**
- 1 FARMER (phone: 9000000001, cluster: Sangli)
- 1 CONSUMER (phone: 9000000002, pincode: 110001)
- 1 BULK_BUYER (company: Fresh Provisions Pvt Ltd)
- 1 LOGISTICS (vehicle: cold van, MH-AB-1234)
- 1 ADMIN

**Demand Forecast Data (synthetic, 12 months):**
- Delhi: turmeric demand curve with Navratri spike, monsoon dip
- Mumbai: honey demand with festival peaks
- Ahmedabad: mustard oil demand with winter cooking season spike

All seed data labeled with `-- SEED DATA` comment in SQL. Separate from migration files.

---

*End of BHARATPURE-CLAUDE.md — Batch 1 of 5*  
*Next: BHARATPURE-DB.md — complete schema, all tables, migration files, key SQL patterns*
