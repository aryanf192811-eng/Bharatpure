# BharatPure — Supervisor ↔ Subagent Task Board
> This is the live relay file between supervisor (Claude Code) and subagent (Antigravity / secondary Claude).
> Supervisor writes tasks. Subagent claims, implements, verifies, and reports back here.
> This file is the source of truth for what is being worked on right now.

---

## HOW THIS WORKS

1. **Supervisor** writes a task: narrow scope, unambiguous spec, concrete acceptance check.
2. **Subagent** claims it (status → IN_PROGRESS), does exactly what the spec says, nothing more.
3. **Subagent** writes its result + verification output into the task's Result field.
4. **Supervisor** reviews: marks VERIFIED or writes NEEDS_REVISION with the exact issue.
5. Repeat.

**Status ladder:** `QUEUED → CLAIMED → IN_PROGRESS → SUBMITTED → NEEDS_REVISION → VERIFIED`

---

## STANDING RULES

- **File ownership is strict.** No two open (non-VERIFIED) tasks may list overlapping files. Check this board before writing a new task.
- **Schema and migrations are NEVER a subagent task.** Supervisor writes all migration files directly.
- **Escalation:** If a subagent hits a design decision (schema change, API contract change, auth logic, security) — STOP. Write the question into the task's Result field. Do not guess.
- **Research tasks** output to `docs/research/{topic}.md`. Never paste findings into this file. Link to the file instead.
- **Acceptance checks are mandatory.** A task without a curl command, newman assertion, or manual verification step is not complete.
- **Every VERIFIED task = 1 commit** minimum. Do not batch unrelated tasks into one commit.

---

## TASK ENTRY TEMPLATE

```
### TASK-XXX
- **Title:**
- **Status:** QUEUED
- **Owner:** (supervisor | subagent)
- **Scope:** (exact files this task may touch — nothing outside this list)
- **Spec:** (what to build — precise, no ambiguity)
- **Acceptance Check:** (exact curl / newman / psql command to verify)
- **Result/Notes:** _(subagent fills this after completion)_
```

---

## PHASE 0 — FOUNDATION

### TASK-001
- **Title:** Initialize backend — install dependencies and Express app skeleton
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/package.json`, `backend/src/app.js`, `backend/src/server.js`, `backend/src/utils/response.js`, `backend/src/utils/logger.js`
- **Spec:** Init Node project. Install: express, pg, node-pg-migrate, jsonwebtoken, bcrypt, zod, pino, pino-http, cors, helmet, express-rate-limit, multer, qrcode, node-cron, twilio, @anthropic-ai/sdk, dotenv, uuid. Create `app.js` with: pino-http logger, cors (CORS_ORIGIN env), helmet, express.json(), global rate limiter (100/min). Create `server.js` importing app, listening on PORT. Create `utils/response.js` with sendSuccess, sendError, sendPaginated (exact shapes from BHARATPURE-API.md). Create `utils/logger.js` exporting pino instance. Global error handler as last middleware in app.js — never leaks stack trace. Health route: GET /health → 200 `{"status":"ok"}`.
- **Acceptance Check:** `node src/server.js` starts. `curl http://localhost:5000/health` → `{"status":"ok"}`. No unhandled errors on startup.
- **Result/Notes:** _(subagent fills this)_

---

### TASK-002
- **Title:** Setup node-pg pool and run migration 001 — users table
- **Status:** QUEUED
- **Owner:** supervisor
- **Scope:** `backend/src/db/index.js`, `backend/src/db/migrations/001_create_users.js`
- **Spec:** Pool in db/index.js from DATABASE_URL env. Export `query(text, params)` with pino logging on every query (info level). Migration 001: users table exactly per BHARATPURE-DB.md — all 12 columns, all constraints, phone UNIQUE, email UNIQUE, role CHECK, status CHECK, otp_purpose CHECK. All three indexes: idx_users_phone, idx_users_email, idx_users_role.
- **Acceptance Check:** `npx node-pg-migrate up` exits 0. `psql $DATABASE_URL -c "\d users"` shows all 12 columns with correct types and constraints.
- **Result/Notes:** _(supervisor fills after running migration)_

---

### TASK-003
- **Title:** Migrations 002–005 (otp_attempts, refresh_tokens, clusters, farmer_profiles)
- **Status:** QUEUED
- **Owner:** supervisor
- **Scope:** `backend/src/db/migrations/002_create_otp_attempts.js` through `005_create_farmer_profiles.js`
- **Spec:** One file per table per BHARATPURE-DB.md. otp_attempts: idx_otp_attempts_user_recent. refresh_tokens: token_hash UNIQUE, idx on user_id WHERE revoked_at IS NULL. clusters: idx on crop_type, idx on state. farmer_profiles: user_id UNIQUE FK, agristack_farmer_id UNIQUE (nullable).
- **Acceptance Check:** `npx node-pg-migrate up` exits 0. All 5 tables visible in psql.
- **Result/Notes:** _(supervisor fills)_

---

### TASK-004
- **Title:** Migrations 006–010 (fpo_profiles, cluster_farmers, procurement_contracts, batches, bir_events)
- **Status:** QUEUED
- **Owner:** supervisor
- **Scope:** `backend/src/db/migrations/006_*.js` through `010_*.js`
- **Spec:** Per BHARATPURE-DB.md exactly. Critical: batches must have `CHECK (remaining_quantity_kg >= 0)`. bir_events must have `UNIQUE INDEX idx_bir_qr_burned_unique ON bir_events(batch_id) WHERE event_type = 'QRBurned'`. batches.qr_hash UNIQUE. All event_type CHECK values listed.
- **Acceptance Check:** `\d batches` shows remaining_quantity_kg CHECK constraint. `\d bir_events` shows the partial unique index.
- **Result/Notes:** _(supervisor fills)_

---

### TASK-005
- **Title:** Migrations 011–020 (quality through temperature_logs)
- **Status:** QUEUED
- **Owner:** supervisor
- **Scope:** `backend/src/db/migrations/011_*.js` through `020_*.js`
- **Spec:** Tables: quality_tests, quality_certificates, b_sample_requests, listings, orders, order_items, escrow_transactions, delivery_routes, route_stops, temperature_logs. orders.status CHECK must list all 8 statuses. escrow_transactions: order_id UNIQUE (one escrow per order).
- **Acceptance Check:** All 20 tables present. `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'` = 20.
- **Result/Notes:** _(supervisor fills)_

---

### TASK-006
- **Title:** Migrations 021–030 (disputes through audit_logs)
- **Status:** QUEUED
- **Owner:** supervisor
- **Scope:** `backend/src/db/migrations/021_*.js` through `030_*.js`
- **Spec:** Tables: disputes, dispute_evidence, demand_forecasts, price_intelligence, simulation_runs, fpo_trust_scores, buyer_reliability_scores, whatsapp_sessions, notifications, audit_logs. whatsapp_sessions: phone UNIQUE. demand_forecasts: UNIQUE(crop_type, city, forecast_date, model_version).
- **Acceptance Check:** All 30 tables present. `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'` = 30. `npx node-pg-migrate up` is idempotent (run twice, no errors).
- **Result/Notes:** _(supervisor fills)_

---

### TASK-007
- **Title:** Auth service — register logic with role-specific profile creation
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/services/auth.service.js`, `backend/src/validators/auth.validator.js`
- **Spec:** Implement `register(data)`. Zod validation: role-discriminated union (FARMER requires fpo_name + registration_number + state + district + primary_crop_types; CONSUMER requires delivery_pincode; BULK_BUYER requires company_name + gstin + business_type; LOGISTICS requires vehicle_type + vehicle_registration_number; ADMIN requires admin_code matching ADMIN_REGISTRATION_CODE env). bcrypt hash password (rounds=12). Generate 6-digit OTP string, bcrypt hash it, store hash. Set otp_expires_at = NOW()+10min, otp_purpose='registration'. Insert user (status='pending'). Insert role-specific profile in same transaction (BEGIN/COMMIT). Return { userId, devOtp } — devOtp is the raw OTP string (NOT the hash). Research task: document Zod discriminated union pattern in docs/research/zod-discriminated-union.md before implementing.
- **Acceptance Check:** Call register with FARMER data → users table has status='pending', otp_hash is a bcrypt string (starts with $2b$), NOT the raw OTP. fpo_profiles table has a matching row. devOtp returned is 6 digits numeric.
- **Result/Notes:** _(subagent fills)_

---

### TASK-008
- **Title:** Auth service — verifyOtp, login, refresh token rotation
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/services/auth.service.js` (extend)
- **Spec:** `verifyOtp(phone, otp, purpose)`: lookup user by phone+purpose, check otp_expires_at > NOW(), bcrypt.compare(otp, otp_hash), insert into otp_attempts, check attempts < 5 in last 15min (429 if exceeded), on success: set status='active', NULL out otp_hash/otp_expires_at/otp_purpose, issue accessToken (15min JWT) + refreshToken (7d JWT), store refreshToken hash (SHA-256) in refresh_tokens table, return both tokens. `login(identifier, password)`: find user by phone or email, bcrypt.compare, check status (pending→403 OTP_REQUIRED, suspended→403). Token rotation on `refresh(token)`: hash incoming token, find in refresh_tokens WHERE revoked_at IS NULL, if not found or revoked: revoke ALL user tokens + throw 401. If valid: set revoked_at=NOW(), issue new pair.
- **Acceptance Check:** Register → verifyOtp → login flow returns accessToken. Use expired/revoked refresh token → 401 + all user tokens revoked (check refresh_tokens table).
- **Result/Notes:** _(subagent fills)_

---

### TASK-009
- **Title:** Auth routes + middleware (verifyToken, requireRoles)
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/middleware/auth.js`, `backend/src/routes/auth.routes.js`, `backend/src/controllers/auth.controller.js`, `backend/src/app.js`
- **Spec:** middleware/auth.js: verifyToken (extract Bearer, jwt.verify with JWT_ACCESS_SECRET, attach to req.user, 401 on TokenExpiredError/JsonWebTokenError). requireRoles(...roles) factory. auth.routes.js: all 8 auth routes per BHARATPURE-API.md (register, verify-otp, login, forgot-password, verify-reset-otp, reset-password, refresh, logout). Rate limits: register 3/hr/IP, login 10/15min/IP, forgot-password 3/hr/IP, verify-otp 5/15min/user. All controllers follow template: validate → try/catch → service call → side effects → log → sendSuccess/sendError. Refresh token in HttpOnly cookie (sameSite:'strict', secure: NODE_ENV==='production'). Add all 8 routes to Postman collection with test scripts that set {{farmerToken}}, {{consumerToken}} etc.
- **Acceptance Check:** `newman run backend/postman/-collection.json -e backend/postman/-environment.json --folder Auth` — all 8 routes pass. GET /api/users/me without token → 401. With FARMER token calling ADMIN route → 403.
- **Result/Notes:** _(subagent fills)_

---

### TASK-010
- **Title:** Seed data script
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/db/seed.js`
- **Spec:** Implement seed.js per BHARATPURE-CLAUDE.md seed data spec. Creates: 3 clusters, 3 FPO users + fpo_profiles, 1 consumer user, 1 bulk buyer user, 1 logistics user, 1 admin user (with known passwords like 'Test@1234' for demo), 6 batches with different statuses, 1 listing per listed batch, 1 order (delivered status), 1 escrow (released). BIR events for each batch (minimum 3 events each). Demand forecast rows for Turmeric+Delhi 30 days. Use known UUIDs (hardcoded) so seed is idempotent — `ON CONFLICT DO NOTHING` on all inserts. Add `-- SEED DATA` comment to every SQL block. `node src/db/seed.js` must be safe to run multiple times.
- **Acceptance Check:** Run seed.js twice — no errors, no duplicates. `SELECT COUNT(*) FROM batches` = 6. `SELECT COUNT(*) FROM bir_events` >= 18. Login with seeded farmer phone → success.
- **Result/Notes:** _(subagent fills)_

---

## PHASE 0 ACCEPTANCE GATE
All must be true before Phase 1 tasks are written:
- [ ] All 30 migrations pass `npx node-pg-migrate up` cleanly
- [ ] Newman auth suite: all 8 routes pass
- [ ] Seed script: idempotent, all demo users login successfully
- [ ] GET /health → 200
- [ ] FastAPI AI service: health check passes, /demand/forecast returns valid response
- [ ] Result committed: `docs/testing/phase-0-newman-{date}.txt`

---

## PHASE 1 — FARMER CORE
_(Tasks written after Phase 0 gate passes)_

### TASK-P1-001
- **Title:** Batch CRUD — create, list, get, soft delete
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/batch.routes.js`, `backend/src/controllers/batch.controller.js`, `backend/src/services/batch.service.js`
- **Spec:** POST /api/batches: validate → generate batch_code → generate qr_hash (HMAC-SHA256 with QR_SECRET) → insert batch (status='draft', remaining_quantity_kg=total_quantity_kg) → insert BatchCreated + HarvestDataLogged BIR events in same transaction. GET /api/batches: role-filtered (FARMER sees own, CONSUMER/BULK_BUYER see listed/partially_sold only, ADMIN sees all). GET /api/batches/:id: full batch with latest quality test + BIR events. DELETE /api/batches/:id: soft delete only if status IN ('draft','test_failed'). All routes in Postman collection.
- **Acceptance Check:** Create batch → batch_code matches pattern MH-TUR-2026-NNN, qr_hash is 64-char hex, 2 BIR events exist. Delete listed batch → 422 BATCH_CANNOT_BE_DELETED.
- **Result/Notes:** _(subagent fills)_

---

### TASK-P1-002
- **Title:** Quality tests, certificate upload, B-sample routes
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/quality.routes.js`, `backend/src/controllers/quality.controller.js`, `backend/src/services/quality.service.js`
- **Spec:** POST /api/quality/tests: validate tier/result/purity_score, append BIR event, update batches.quality_score, enforce state machine (pending_test only), TIER2 FAIL sets batch to test_failed + creates b_sample_requests record. POST /api/quality/certificates: multer middleware, MIME check (application/pdf only), size check (≤5MB), save file, create cert record, append NABLCertificateLinked BIR event. GET /api/quality/b-samples/:batchId. POST /api/quality/b-samples/:batchId/request: check window open.
- **Acceptance Check:** Upload non-PDF → 400 INVALID_MIME_TYPE. Upload valid PDF → cert record created, BIR event appended. TIER1 FAIL → b_sample_requests row created with request_window_end = 7 days from now.
- **Result/Notes:** _(subagent fills)_

---

### TASK-P1-003
- **Title:** Listings — create, browse, update, pause
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/listing.routes.js`, `backend/src/controllers/listing.controller.js`, `backend/src/services/listing.service.js`
- **Spec:** POST /api/listings: batch must be test_passed, no existing active listing for batch (409 if exists), set batch status='listed', append BatchListed BIR event, fetch price recommendation from AI service and return alongside created listing. GET /api/listings: role-filtered query per BHARATPURE-API.md, demand forecast joined. GET /api/listings/:id: full detail. PATCH /api/listings/:id: price change blocked if pending orders. PATCH /api/listings/:id/status. GET /api/listings/recommended.
- **Acceptance Check:** List batch in wrong status → 422. Create valid listing → BatchListed BIR event exists. Fetch /listings/recommended for city=Delhi → returns demand_forecast_kg alongside each listing.
- **Result/Notes:** _(subagent fills)_

---

## PHASE 2 — DECISION ENGINE INTEGRATION
_(Tasks written after Phase 1 gate passes)_

### TASK-P2-001
- **Title:** Demand and price intelligence routes (proxy to AI service)
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/demand.routes.js`, `backend/src/routes/price.routes.js`, `backend/src/services/ai.service.js`
- **Spec:** ai.service.js: axios client for AI_SERVICE_URL with 30s timeout, error handling that returns stale DB cache on 500/timeout (never propagate AI service failure as 500 to frontend). GET /api/demand/forecast: check demand_forecasts cache first (< 6h old), if fresh return cache, else call AI service + store result + return. GET /api/demand/multi-city. POST /api/demand/refresh (ADMIN only). GET /api/price/recommendation. GET /api/price/market-rates (from enam-prices.json). GET /api/price/premium-calculator.
- **Acceptance Check:** Stop AI service → GET /api/demand/forecast returns stale:true with cached data, NOT 500. AI service running → returns fresh data with stale:false.
- **Result/Notes:** _(subagent fills)_

---

### TASK-P2-002
- **Title:** What-if simulator route and simulation history
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/simulation.routes.js`, `backend/src/controllers/simulation.controller.js`
- **Spec:** POST /api/simulation/run: validate input, call AI service /simulation/run, store result in simulation_runs table, return to client. GET /api/simulation/history (ADMIN only): paginated list.
- **Acceptance Check:** POST simulation → simulation_runs table has new row. Call with invalid demand_spike_pct (-5) → 400 VALIDATION_ERROR.
- **Result/Notes:** _(subagent fills)_

---

## PHASE 3 — MARKETPLACE + ORDERS
_(Tasks written after Phase 2 gate passes)_

### TASK-P3-001
- **Title:** Order creation with atomic escrow hold
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/order.routes.js`, `backend/src/controllers/order.controller.js`, `backend/src/services/order.service.js`
- **Spec:** POST /api/orders: full atomic transaction per BHARATPURE-DB.md Pattern (escrow hold + order create + batch decrement + batch status update in single BEGIN/COMMIT). Use `FOR UPDATE` on batch row. If remaining_quantity_kg < requested → 409 INSUFFICIENT_STOCK. Validate min/max order per listing. Create order_items. Hold escrow. Append OrderAllocated BIR event. All error cases per BHARATPURE-API.md.
- **Acceptance Check:** Attempt to order more than remaining_quantity_kg → 409. Two concurrent orders for last 100kg → only one succeeds (test with two rapid curl calls). Successful order → batch.remaining_quantity_kg decremented, escrow_transactions row created with status='held'.
- **Result/Notes:** _(subagent fills)_

---

### TASK-P3-002
- **Title:** QR scan, QR burn, dispute routes
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/qr.routes.js`, `backend/src/routes/dispute.routes.js`, corresponding controllers/services
- **Spec:** GET /api/qr/scan/:qrHash: public, appends QRScanned BIR event, returns full BIR view. POST /api/qr/burn/:qrHash: requires auth, appends QRBurned BIR event, sets qr_burned_at — MUST handle unique constraint violation with 409 QR_ALREADY_BURNED (not 500). POST /api/disputes: 48h window enforced, sets order status='disputed', blocks escrow release. PATCH /api/disputes/:id/resolve (ADMIN): triggers partial/full escrow refund if refund_amount_paise > 0.
- **Acceptance Check:** Burn QR twice → second call returns 409 QR_ALREADY_BURNED, not 500. Raise dispute > 48h after delivery → 422 DISPUTE_WINDOW_CLOSED. Resolve dispute with refund → escrow_transactions updated.
- **Result/Notes:** _(subagent fills)_

---

## PHASE 4 — LOGISTICS + TRUST
_(Tasks after Phase 3 gate)_

### TASK-P4-001
- **Title:** Logistics routes — dashboard, route management, temperature logging
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/logistics.routes.js`, controllers/services
- **Spec:** All logistics routes per BHARATPURE-API.md. Temperature log: if breach detected → append TemperatureBreachDetected BIR event + create notification + flag batch (add note 'TEMP_BREACH_REVIEW') + block DeliveredToConsumer until admin clears. PATCH /api/orders/:orderId/delivered: check for temp breach flag and open disputes before releasing escrow. Escrow release: atomic per BHARATPURE-DB.md escrow release pattern.
- **Acceptance Check:** Log temperature above threshold → TemperatureBreachDetected BIR event exists, notification created, attempt to mark delivered → 422 TEMPERATURE_BREACH_REVIEW. Admin clears breach → delivered succeeds, escrow released, EscrowReleased BIR event exists.
- **Result/Notes:** _(subagent fills)_

---

## PHASE 5 — ADMIN + DPI + POLISH
_(Tasks after Phase 4 gate)_

### TASK-P5-001
- **Title:** Admin routes, IEI computation, escrow management, audit logs
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/admin.routes.js`, controllers/services
- **Spec:** All admin routes per BHARATPURE-API.md. IEI dashboard: SQL Pattern 4 from BHARATPURE-DB.md. Admin escrow release: mandatory reason field, writes audit_log, release_triggered_by='MANUAL_ADMIN'. Route optimization: calls AI service /routing/optimize, creates delivery_routes + route_stops records. Admin user status change: writes audit_log mandatory.
- **Acceptance Check:** GET /api/admin/dashboard returns iei object with all 5 metrics. Admin manual escrow release without reason field → 400. Release with reason → audit_log row created with actor_id.
- **Result/Notes:** _(subagent fills)_

---

### TASK-P5-002
- **Title:** DPI mock routes and WhatsApp webhook
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/routes/dpi.routes.js`, `backend/src/routes/webhooks.js`, `backend/src/services/whatsapp.service.js`
- **Spec:** DPI routes: all 3 per BHARATPURE-API.md, all responses labeled with data_source field. WhatsApp webhook: Twilio signature validation (skip in dev), parse form-urlencoded body, call whatsapp.service.js (full implementation per BHARATPURE-AI.md), return TwiML. whatsapp.service.js: session management, Claude API intent extraction, Decision Engine API calls, bilingual response generation. Never 500 to Twilio — always return TwiML even on error.
- **Acceptance Check:** POST /api/webhooks/whatsapp with valid Twilio body → TwiML response (Content-Type: text/xml). Send "Delhi mein haldi ka rate" → response contains price numbers in rupees. Invalid Twilio signature in production mode → 403.
- **Result/Notes:** _(subagent fills)_

---

### TASK-P5-003
- **Title:** FPO Trust Score + Buyer Reliability Score cron jobs
- **Status:** QUEUED
- **Owner:** subagent
- **Scope:** `backend/src/jobs/trust-score.job.js`, `backend/src/jobs/index.js`
- **Spec:** node-cron scheduled job: runs nightly at 2am IST. Computes trust score per BHARATPURE-DB.md formula for all FPOs with activity. Inserts new row into fpo_trust_scores. Same for buyer_reliability_scores. Updates fpo_profiles.trust_score with latest computed_score. Expose manual trigger: POST /api/admin/jobs/trust-scores (ADMIN only).
- **Acceptance Check:** POST /api/admin/jobs/trust-scores → fpo_trust_scores table has new rows for all 3 seeded FPOs with computed_score > 0.
- **Result/Notes:** _(subagent fills)_

---

## PHASE 0 NEWMAN RESULTS LOG
| Date | Phase | Routes Tested | Pass | Fail | File |
|---|---|---|---|---|---|
| _(fill after each run)_ | | | | | |
```
