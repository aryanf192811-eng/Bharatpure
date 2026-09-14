# CLAUDE-CODE-BACKEND.md
> Paste this as your first message to Claude Code when starting the backend.
> Claude Code must read all referenced files before writing any code.

---

## YOUR FIRST MESSAGE TO CLAUDE CODE (paste this exactly):

---

You are the supervisor engineer on BharatPure — SIH 2026, PS 26033. This is a production-grade build, not a prototype. Read every instruction before touching a file.

**Step 1 — Read these files in full before doing anything else:**
1. `BHARATPURE-CLAUDE.md` — product context, stack, RBAC, auth spec, build roadmap, git rules
2. `BHARATPURE-DB.md` — full schema, all 30 tables, SQL patterns, edge cases
3. `BHARATPURE-API.md` — all routes, request/response shapes, controller template, error codes
4. `chatbot.md` — the task board you'll work from

Do not proceed until you have read all four files. Confirm you've read them by stating:
- The 5 RBAC roles and their portal types
- The 3 golden SQL rules from BHARATPURE-DB.md
- The response wrapper shape (sendSuccess/sendError)
- The git commit strategy (granularity level)

**Step 2 — Plan before every task:**
Before implementing anything, state:
1. What this task touches (files, DB tables, routes)
2. At least 3 edge cases and how you'll handle them
3. The acceptance check you'll run to verify it works
4. Any research needed before starting (document in docs/research/)

**Step 3 — Work from chatbot.md:**
Start with TASK-001. Claim it, implement it, write your verification result back into chatbot.md. Do not start TASK-002 until TASK-001 is verified. Follow the status ladder strictly.

**Step 4 — Git discipline:**
- One commit per route implemented: `feat: implement POST /api/auth/register`
- One commit per migration: `chore: add 001_create_users migration`
- One commit per bug fixed: `fix: handle null quality_score in price intelligence`
- One commit per test added to Postman: `test: add verify-otp to postman collection`
- One commit per research doc: `docs: research on Zod discriminated union pattern`
- Never batch two independent things into one commit
- All commits under your own name only. No Co-Authored-By. No AI attribution.

**Step 5 — Never do these:**
- Never `SELECT *` in any query
- Never string-interpolate SQL — always `$1, $2` parameterized
- Never access `rows[0]` without checking `rows.length` first
- Never skip the try/catch → next(err) pattern in controllers
- Never store monetary values as float — always paise (integer)
- Never update or delete a `bir_events` row — it is append-only forever
- Never let AI service failure propagate as a 500 — always return cached data with `stale: true`

**Your environment:**
- Node.js 20, Express 4, PostgreSQL 16
- DATABASE_URL is set in backend/.env
- AI service runs at http://localhost:8000 (start it separately with uvicorn)
- Postman collection lives at backend/postman/-collection.json
- newman is available globally

**Start now with TASK-001 from chatbot.md. Read BHARATPURE-CLAUDE.md first.**

---

## PHASE-BY-PHASE PROMPTS (paste these as you progress)

### After Phase 0 gate passes — start Phase 1:
```
Phase 0 is complete. All migrations pass, auth routes pass newman, seed data loads.

Now implement Phase 1 — Farmer Core. Work through these in order from chatbot.md:
TASK-P1-001 (Batch CRUD), TASK-P1-002 (Quality tests + certificates), TASK-P1-003 (Listings).

Before starting each task:
- Re-read the relevant section in BHARATPURE-DB.md for the tables involved
- Re-read the relevant routes in BHARATPURE-API.md
- State your implementation plan and edge cases
- Run the acceptance check before marking any task SUBMITTED

Remember: one commit per route, one commit per bug fix. Keep commit count high.
```

### After Phase 1 gate passes — start Phase 2:
```
Phase 1 complete. Farmer can create batches, submit quality tests, and list produce.

Now implement Phase 2 — Decision Engine Integration.
TASK-P2-001 (Demand + Price routes), TASK-P2-002 (What-if Simulator).

Critical: the AI service must be running. Test it first:
curl http://localhost:8000/health

The demand route must handle AI service downtime gracefully — check demand_forecasts 
cache in DB first (< 6h old), return stale:true if serving from cache.
Never let AI service failure return 500 to the frontend.
```

### After Phase 2 gate passes — start Phase 3:
```
Phase 2 complete. Decision Engine integrated.

Now implement Phase 3 — Marketplace and Orders.
TASK-P3-001 (Order creation with atomic escrow), TASK-P3-002 (QR + Disputes).

The order creation is the most critical piece of the entire backend.
Read BHARATPURE-DB.md Pattern (escrow hold + order create) before writing a single line.
The atomic transaction must handle: concurrent orders, out-of-stock, min/max order,
listing type mismatch. Test the concurrent order edge case explicitly.
```

### After Phase 3 gate passes — start Phase 4:
```
Phase 3 complete. Orders and escrow working.

Now implement Phase 4 — Logistics and Trust.
TASK-P4-001 (Logistics routes + temperature logging).

The temperature breach flow is the most important: breach → BIR event → notification
→ flag batch → BLOCK escrow release until admin clears.
Test this explicitly before marking complete.
```

### After Phase 4 gate passes — start Phase 5:
```
Phase 4 complete. Logistics and trust layer working.

Now implement Phase 5 — Admin, DPI, WhatsApp, Polish.
TASK-P5-001 (Admin + IEI), TASK-P5-002 (DPI mock + WhatsApp), TASK-P5-003 (Trust score cron).

For the WhatsApp bot: the full implementation is in BHARATPURE-AI.md under 
"WHATSAPP BOT — FULL IMPLEMENTATION". Copy the whatsapp.service.js implementation
exactly — do not rewrite it. The intent extraction and response generation via 
Claude API are already designed; implement as written.

After all Phase 5 tasks are VERIFIED:
1. Run full newman suite across all route groups
2. Log result to docs/testing/final-newman-{date}.txt
3. Commit: `test: final newman full suite — all routes pass`
4. Run seed.js one final time to confirm idempotent
5. Commit: `chore: final seed data confirmed clean`
```

---

## BACKEND ACCEPTANCE CRITERIA — DEMO READY

Before declaring backend demo-ready, every item must be true:

```
Auth:
[ ] Register → OTP → Login flow works for all 5 roles
[ ] devOtp appears in response in dev mode
[ ] Refresh token rotation works (second use of revoked token revokes all)
[ ] Wrong role on protected route → 403

Batches:
[ ] Create batch → batch_code generated, qr_hash generated (HMAC, 64-char hex)
[ ] 2 BIR events auto-created (BatchCreated + HarvestDataLogged)
[ ] Delete listed batch → 422

Quality:
[ ] NABL PDF upload → cert record + BIR event. Non-PDF → 400
[ ] TIER2 FAIL → batch.status = 'test_failed', b_sample_requests row created

Orders:
[ ] Concurrent order beyond stock → only one succeeds (race condition test)
[ ] Successful order → escrow held, batch.remaining_quantity_kg decremented
[ ] QR burn → idempotent (second burn = 409, not 500)
[ ] Dispute > 48h → 422

Logistics:
[ ] Temperature breach → TemperatureBreachDetected BIR event + notification
[ ] Deliver with breach flag → 422 until admin clears

AI Integration:
[ ] AI service down → /api/demand/forecast returns cached data with stale:true
[ ] /api/simulation/run → simulation_runs row created

Admin:
[ ] IEI dashboard returns all 5 metrics
[ ] Manual escrow release without reason → 400
[ ] Audit log written on every admin state change

WhatsApp:
[ ] POST /api/webhooks/whatsapp → valid TwiML response
[ ] Hindi price query → response contains rupee amounts

Newman:
[ ] All route groups pass full newman run
[ ] Result logged to docs/testing/
```
