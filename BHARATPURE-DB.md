# BHARATPURE-DB.md — Database Schema & SQL Guide
> Read fully before writing a single migration. Every table is intentional.
> Claude Code: plan your queries, then write them. No SELECT *. No string interpolation. Ever.

---

## GOLDEN RULES (non-negotiable)

1. **All queries are parameterized.** `WHERE id = $1` — never `WHERE id = '${id}'`.
2. **Never `SELECT *`.** Name every column you need.
3. **Always check `rows.length` before `rows[0]`.** A missing row is a logic error, not a crash.
4. **Multi-table writes use a transaction.** `BEGIN` → operations → `COMMIT`. On any error, `ROLLBACK`.
5. **All monetary values in PAISE (integer).** ₹188.50/kg = `18850`. Never store rupees as float. Prevents all floating-point precision bugs.
6. **BIR events are append-only.** Never UPDATE or DELETE a `bir_events` row. Ever.
7. **Soft delete everywhere user-facing.** Add `deleted_at TIMESTAMPTZ DEFAULT NULL`. A record with `deleted_at IS NOT NULL` is invisible to all queries. Never hard-delete user data.
8. **Timestamps always with timezone.** `TIMESTAMPTZ`, never `TIMESTAMP`. India is IST (UTC+5:30) but the DB stores UTC.

---

## MIGRATION FILE NAMING CONVENTION

```
backend/src/db/migrations/
  001_create_users.js
  002_create_otp_attempts.js
  003_create_refresh_tokens.js
  004_create_clusters.js
  005_create_farmer_profiles.js
  006_create_fpo_profiles.js
  007_create_cluster_farmers.js
  008_create_procurement_contracts.js
  009_create_batches.js
  010_create_bir_events.js
  011_create_quality_tests.js
  012_create_quality_certificates.js
  013_create_b_sample_requests.js
  014_create_listings.js
  015_create_orders.js
  016_create_order_items.js
  017_create_escrow_transactions.js
  018_create_delivery_routes.js
  019_create_route_stops.js
  020_create_temperature_logs.js
  021_create_disputes.js
  022_create_dispute_evidence.js
  023_create_demand_forecasts.js
  024_create_price_intelligence.js
  025_create_simulation_runs.js
  026_create_fpo_trust_scores.js
  027_create_buyer_reliability_scores.js
  028_create_whatsapp_sessions.js
  029_create_notifications.js
  030_create_audit_logs.js
```

Each migration is one commit. Do not combine migrations.

---

## FULL TABLE REFERENCE

### 1. `users`
Base identity table. All roles share this table.

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(15) UNIQUE NOT NULL,         -- primary identifier for all roles
  email           VARCHAR(255) UNIQUE,                 -- required for BULK_BUYER, ADMIN; optional for others
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('FARMER','CONSUMER','BULK_BUYER','LOGISTICS','ADMIN')),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  full_name       VARCHAR(255) NOT NULL,
  otp_hash        VARCHAR(255),                        -- bcrypt hash of OTP; NULL when no OTP pending
  otp_expires_at  TIMESTAMPTZ,
  otp_purpose     VARCHAR(30) CHECK (otp_purpose IN ('registration','password_reset')),
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
```

**Edge cases:**
- OTP fields cleared to NULL after successful verification (never leave old OTP in DB)
- `status: 'pending'` blocks login — forces OTP completion
- Soft delete: `deleted_at IS NOT NULL` means account deactivated, not removed

---

### 2. `otp_attempts`
Tracks OTP submission attempts per user to enforce lockout.

```sql
CREATE TABLE otp_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  succeeded   BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address  VARCHAR(45)
);

CREATE INDEX idx_otp_attempts_user_recent ON otp_attempts(user_id, attempted_at DESC);
```

**Lockout rule (enforce in service layer):**  
Count attempts in last 15 minutes per user. If `>= 5` AND all failed → return 429, set `users.status = 'suspended'` for 15 minutes. Never lock permanently on OTP; only lock temporarily.

**Rate limit rule (separate from lockout):**  
Only 1 OTP generation request per phone per 60 seconds. Check `otp_expires_at > NOW() - INTERVAL '9 minutes'` before issuing a new OTP.

---

### 3. `refresh_tokens`
Tracks issued refresh tokens for rotation. Invalidate old token on refresh.

```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  token_hash  VARCHAR(255) NOT NULL UNIQUE,  -- SHA-256 of the raw token
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ DEFAULT NULL,
  ip_address  VARCHAR(45),
  user_agent  TEXT
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
```

**Rotation:** On POST `/api/auth/refresh`, the old token's `revoked_at` is set to NOW() and a new token is issued in the same transaction. If the same revoked token is used again, revoke ALL tokens for that user (token theft detection).

---

### 4. `clusters`
Geographic farmer clusters. One crop type per cluster.

```sql
CREATE TABLE clusters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  crop_type       VARCHAR(100) NOT NULL,  -- 'TURMERIC','MUSTARD','HONEY','GROUNDNUT','SPICES','GHEE','OIL'
  state           VARCHAR(100) NOT NULL,
  district        VARCHAR(100) NOT NULL,
  latitude        DECIMAL(10, 7) NOT NULL,
  longitude       DECIMAL(10, 7) NOT NULL,
  active_farmers  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clusters_crop ON clusters(crop_type);
CREATE INDEX idx_clusters_state ON clusters(state);
```

---

### 5. `farmer_profiles`
Extended profile for FARMER role users.

```sql
CREATE TABLE farmer_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id),
  cluster_id            UUID REFERENCES clusters(id),
  agristack_farmer_id   VARCHAR(50) UNIQUE,           -- nullable; from AgriStack mock
  land_gps_lat          DECIMAL(10, 7),
  land_gps_lng          DECIMAL(10, 7),
  land_area_acres       DECIMAL(8, 2),
  primary_crop          VARCHAR(100),
  crop_history          JSONB DEFAULT '[]',            -- [{ crop, season, year, yield_kg }]
  quality_premium_earned_paise BIGINT NOT NULL DEFAULT 0,
  total_batches         INTEGER NOT NULL DEFAULT 0,
  fulfillment_rate      DECIMAL(5, 2),                -- 0.00 to 100.00
  state                 VARCHAR(100),
  district              VARCHAR(100),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 6. `fpo_profiles`
Extended profile for FPO-operating FARMER users (same role, additional org data).

```sql
CREATE TABLE fpo_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id),
  fpo_name              VARCHAR(255) NOT NULL,
  registration_number   VARCHAR(100) UNIQUE NOT NULL, -- state FPO registration
  state                 VARCHAR(100) NOT NULL,
  district              VARCHAR(100) NOT NULL,
  primary_crop_types    TEXT[] NOT NULL DEFAULT '{}', -- ARRAY of crop types
  member_count          INTEGER NOT NULL DEFAULT 0,
  trust_score           DECIMAL(5, 2) DEFAULT NULL,   -- computed, see fpo_trust_scores
  ondc_seller_id        VARCHAR(100) UNIQUE,           -- assigned on ONDC SNP registration
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 7. `cluster_farmers`
M2M: which farmers belong to which cluster.

```sql
CREATE TABLE cluster_farmers (
  cluster_id  UUID NOT NULL REFERENCES clusters(id),
  farmer_id   UUID NOT NULL REFERENCES farmer_profiles(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cluster_id, farmer_id)
);
```

---

### 8. `procurement_contracts`
Pre-sowing agreements between BharatPure and FPOs. The "forward market" layer.

```sql
CREATE TABLE procurement_contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fpo_id                UUID NOT NULL REFERENCES fpo_profiles(id),
  cluster_id            UUID NOT NULL REFERENCES clusters(id),
  crop_type             VARCHAR(100) NOT NULL,
  quantity_kg           DECIMAL(10, 2) NOT NULL,
  price_floor_paise     BIGINT NOT NULL,               -- minimum guaranteed price/kg in paise
  price_ceiling_paise   BIGINT NOT NULL,               -- maximum price band/kg in paise
  sowing_date           DATE NOT NULL,
  expected_harvest_date DATE NOT NULL,
  advance_amount_paise  BIGINT NOT NULL DEFAULT 0,     -- 10% sowing advance
  advance_disbursed_at  TIMESTAMPTZ,
  advance_disbursed_via VARCHAR(50),                   -- 'NBFC_PARTNER', 'DIRECT'
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','active','fulfilled','partially_fulfilled','cancelled','defaulted')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_fpo ON procurement_contracts(fpo_id);
CREATE INDEX idx_contracts_status ON procurement_contracts(status);
CREATE INDEX idx_contracts_harvest ON procurement_contracts(expected_harvest_date);
```

**Edge case — side-selling detection:**  
When a batch is created by an FPO that has an active contract, validate that batch's `quantity_kg` doesn't exceed contract's remaining uncommitted quantity. If discrepancy exceeds 20%, flag for review in `audit_logs`.

---

### 9. `batches`
Core entity. Every batch of produce that enters the BharatPure system.

```sql
CREATE TABLE batches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code            VARCHAR(30) NOT NULL UNIQUE,   -- e.g. MH-TUR-2026-014
  cluster_id            UUID NOT NULL REFERENCES clusters(id),
  fpo_id                UUID REFERENCES fpo_profiles(id),
  farmer_id             UUID REFERENCES farmer_profiles(id),  -- null if created by FPO
  contract_id           UUID REFERENCES procurement_contracts(id),
  crop_type             VARCHAR(100) NOT NULL,
  harvest_date          DATE NOT NULL,
  total_quantity_kg     DECIMAL(10, 2) NOT NULL,
  remaining_quantity_kg DECIMAL(10, 2) NOT NULL,       -- decremented atomically on order
  quality_score         DECIMAL(5, 2),                 -- 0–100; null until test result
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft',
                            'pending_test',
                            'test_passed',
                            'test_failed',
                            'listed',
                            'partially_sold',
                            'sold',
                            'dispatched',
                            'delivered',
                            'rejected_post_delivery'  -- dispute outcome
                          )),
  rejection_reason      TEXT,                          -- populated if test_failed
  qr_hash               VARCHAR(64) NOT NULL UNIQUE,   -- SHA-256(batch_id + QR_SECRET)
  qr_burned_at          TIMESTAMPTZ DEFAULT NULL,      -- set when consumer burns QR
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_batches_status ON batches(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_cluster ON batches(cluster_id);
CREATE INDEX idx_batches_fpo ON batches(fpo_id);
CREATE INDEX idx_batches_qr ON batches(qr_hash);
CREATE INDEX idx_batches_crop ON batches(crop_type, status) WHERE deleted_at IS NULL;
```

**Batch code generation pattern:**
```js
// {STATE_CODE}-{CROP_CODE}-{YEAR}-{SEQUENCE}
// e.g. MH-TUR-2026-014
// Sequence is zero-padded 3-digit, per (state, crop, year)
// SELECT MAX(SUBSTRING(batch_code FROM '\d+$')::integer) + 1 FROM batches WHERE batch_code LIKE 'MH-TUR-2026-%'
```

**QR hash generation:**
```js
const crypto = require('crypto');
const qrHash = crypto.createHmac('sha256', process.env.QR_SECRET)
  .update(batchId)
  .digest('hex');
// Never use plain SHA-256 without a secret — that's guessable
```

**State machine — valid transitions only:**
```
draft → pending_test (when batch submitted for testing)
pending_test → test_passed (tier 1 or NABL pass)
pending_test → test_failed (tier 1 or NABL fail)
test_passed → listed (FPO sets price and lists)
listed → partially_sold (first order partially fills)
listed OR partially_sold → sold (quantity reaches 0)
sold → dispatched (logistics picks up)
dispatched → delivered (consumer confirms / BIR event fires)
delivered → rejected_post_delivery (dispute outcome — rare)
```
Any other transition must throw a 422 error. Enforce in service layer, not DB.

---

### 10. `bir_events`
The immutable append-only event log. Every physical action on a batch creates one row.

```sql
CREATE TABLE bir_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES batches(id),
  event_type  VARCHAR(50) NOT NULL CHECK (event_type IN (
    'BatchCreated',
    'HarvestDataLogged',
    'ProcessingStarted',
    'ProcessingCompleted',
    'RapidTestInitiated',
    'RapidTestPassed',
    'RapidTestFailed',
    'BSampleSealed',
    'NABLTestDispatched',
    'NABLCertificateLinked',
    'BatchRejected',
    'BatchListed',
    'OrderAllocated',
    'DispatchedToHub',
    'TempLogEvent',
    'TemperatureBreachDetected',
    'DeliveredToConsumer',
    'QRScanned',
    'QRBurned',
    'EscrowReleased',
    'DisputeRaised',
    'DisputeResolved',
    'BatchWrittenOff'
  )),
  event_data  JSONB NOT NULL DEFAULT '{}',  -- event-specific payload
  actor_id    UUID REFERENCES users(id),    -- who triggered this (null for system events)
  actor_role  VARCHAR(20),
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO updated_at. NO deleted_at. This table is append-only forever.
);

CREATE INDEX idx_bir_batch ON bir_events(batch_id, created_at ASC);
CREATE INDEX idx_bir_event_type ON bir_events(event_type);

-- Enforce: QRBurned can only appear once per batch
CREATE UNIQUE INDEX idx_bir_qr_burned_unique
  ON bir_events(batch_id)
  WHERE event_type = 'QRBurned';
```

**CRITICAL: Never add UPDATE or DELETE to bir_events. If you think you need to — you're wrong. Add a new corrective event instead.**

**TempLogEvent payload example:**
```json
{
  "temperature_c": 7.4,
  "vehicle_id": "MH-AB-1234",
  "location_lat": 19.0760,
  "location_lng": 72.8777,
  "threshold_c": 8.0,
  "breach": false
}
```

**TemperatureBreachDetected payload example:**
```json
{
  "temperature_c": 11.2,
  "breach_threshold_c": 8.0,
  "vehicle_id": "MH-AB-1234",
  "alert_sent_to": ["ops@bharatpure.in"],
  "batch_held_for_review": true
}
```

---

### 11. `quality_tests`
Test results for each batch. A batch can have multiple tests (rapid + NABL).

```sql
CREATE TABLE quality_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES batches(id),
  tier            VARCHAR(10) NOT NULL CHECK (tier IN ('TIER1','TIER2')),  -- TIER1=rapid, TIER2=NABL
  result          VARCHAR(10) NOT NULL CHECK (result IN ('PASS','FAIL','PENDING')),
  purity_score    DECIMAL(5, 2),           -- 0–100; null if failed before scoring
  test_parameters JSONB DEFAULT '{}',      -- actual measured values (curcumin %, lead ppm, etc.)
  lab_name        VARCHAR(255),            -- null for TIER1 (in-house)
  lab_accreditation VARCHAR(50),           -- e.g. 'NABL-12345'
  tested_at       TIMESTAMPTZ,
  tested_by       UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quality_batch ON quality_tests(batch_id, created_at DESC);
```

**Business rule:** A batch moves to `test_passed` only when its LATEST test result is PASS.  
If TIER1 passes but TIER2 fails → batch is `test_failed`. TIER2 always supersedes TIER1.

---

### 12. `quality_certificates`
NABL certificate PDF metadata. Linked to bir_events.

```sql
CREATE TABLE quality_certificates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES batches(id),
  quality_test_id UUID NOT NULL REFERENCES quality_tests(id),
  cert_number     VARCHAR(100) UNIQUE NOT NULL,
  cert_url        TEXT NOT NULL,           -- path or URL to uploaded PDF
  file_size_bytes INTEGER NOT NULL,
  mime_type       VARCHAR(50) NOT NULL DEFAULT 'application/pdf',
  issued_at       DATE NOT NULL,
  expires_at      DATE,                    -- some certs expire; null = permanent
  uploaded_by     UUID REFERENCES users(id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Validation (enforce in controller):**
- MIME type must be `application/pdf`
- File size must be `<= 5MB` (5242880 bytes)
- cert_number must be non-empty after trimming

---

### 13. `b_sample_requests`
B-Sample referee protocol. When TIER1 fails, farmer can request independent NABL verification.

```sql
CREATE TABLE b_sample_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            UUID NOT NULL REFERENCES batches(id),
  quality_test_id     UUID NOT NULL REFERENCES quality_tests(id),  -- the failing TIER1 test
  requested_by        UUID NOT NULL REFERENCES users(id),          -- the farmer
  request_window_end  TIMESTAMPTZ NOT NULL,                        -- 7 days from seal
  status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','lab_selected','dispatched','result_pass','result_fail','expired')),
  selected_lab        VARCHAR(255),
  result              VARCHAR(10) CHECK (result IN ('PASS','FAIL')),
  result_cert_url     TEXT,
  cost_paid_by        VARCHAR(20) CHECK (cost_paid_by IN ('FARMER','BHARATPURE')),
  -- If result_pass: batch reinstated, BharatPure covers cost
  -- If result_fail: rejection stands, farmer covers cost
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 14. `listings`
Marketplace listings. Created from a batch by an FPO/farmer setting a price.

```sql
CREATE TABLE listings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID NOT NULL REFERENCES batches(id),
  listed_by             UUID NOT NULL REFERENCES users(id),
  price_per_kg_paise    BIGINT NOT NULL,          -- price in paise/kg
  min_order_kg          DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  max_order_kg          DECIMAL(10, 2),           -- null = no limit
  listing_type          VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                          CHECK (listing_type IN ('OPEN','BULK_ONLY','CONSUMER_ONLY')),
  available_from        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_until       TIMESTAMPTZ,              -- null = open-ended
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','paused','sold_out','expired','cancelled')),
  ondc_listed           BOOLEAN NOT NULL DEFAULT FALSE,  -- pushed to ONDC SNP adapter
  views_count           INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_listings_batch ON listings(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_status ON listings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_type ON listings(listing_type, status) WHERE deleted_at IS NULL;
```

---

### 15. `orders`
Buyer orders. One order can span multiple listings/batches.

```sql
CREATE TABLE orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id              UUID NOT NULL REFERENCES users(id),
  buyer_role            VARCHAR(20) NOT NULL CHECK (buyer_role IN ('CONSUMER','BULK_BUYER')),
  total_amount_paise    BIGINT NOT NULL,
  status                VARCHAR(30) NOT NULL DEFAULT 'placed'
                          CHECK (status IN (
                            'placed',
                            'confirmed',
                            'allocation_pending',  -- allocation engine running
                            'allocated',
                            'dispatched',
                            'delivered',
                            'cancelled',
                            'refunded',
                            'disputed'
                          )),
  delivery_address      JSONB NOT NULL,           -- { line1, line2, city, state, pincode, lat, lng }
  delivery_notes        TEXT,
  estimated_delivery_at TIMESTAMPTZ,
  actual_delivery_at    TIMESTAMPTZ,
  cancellation_reason   TEXT,
  refund_amount_paise   BIGINT DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer ON orders(buyer_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);
```

**Order state machine:**
```
placed → confirmed (FPO accepts / auto-confirm within 2h)
confirmed → allocation_pending (allocation engine triggered)
allocation_pending → allocated (engine assigns batches to order_items)
allocated → dispatched (logistics picks up)
dispatched → delivered (on DeliveredToConsumer BIR event + escrow release)
placed/confirmed → cancelled (before dispatch; by buyer or system timeout)
delivered → disputed (within 48h of delivery; buyer raises dispute)
```

---

### 16. `order_items`
Line items in an order. Tracks which batch fills which quantity.

```sql
CREATE TABLE order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES orders(id),
  listing_id            UUID NOT NULL REFERENCES listings(id),
  batch_id              UUID NOT NULL REFERENCES batches(id),
  quantity_kg           DECIMAL(10, 2) NOT NULL,
  price_per_kg_paise    BIGINT NOT NULL,          -- locked at order time; not affected by later price changes
  subtotal_paise        BIGINT NOT NULL,          -- quantity_kg * price_per_kg_paise / 1000 (note: kg precision)
  allocated_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_batch ON order_items(batch_id);
```

**Subtotal calculation (critical — do this in DB, not JS):**
```sql
-- subtotal_paise = ROUND(quantity_kg * price_per_kg_paise)
-- This avoids JavaScript floating-point issues entirely
```

---

### 17. `escrow_transactions`
Payment escrow. One escrow per order.

```sql
CREATE TABLE escrow_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL UNIQUE REFERENCES orders(id),
  amount_paise          BIGINT NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'held'
                          CHECK (status IN ('held','released','refunded','partially_refunded')),
  payment_reference     VARCHAR(255),             -- UPI transaction ID
  payment_method        VARCHAR(50) DEFAULT 'UPI',
  held_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at           TIMESTAMPTZ,              -- set on DeliveredToConsumer
  refunded_at           TIMESTAMPTZ,
  refund_amount_paise   BIGINT DEFAULT 0,
  release_triggered_by  VARCHAR(30)               -- 'BIR_EVENT','MANUAL_ADMIN','DISPUTE_RESOLUTION'
);
```

**Atomic escrow hold + order create pattern (use this ALWAYS):**
```sql
BEGIN;

-- Insert the order
INSERT INTO orders (id, buyer_id, total_amount_paise, status, delivery_address)
VALUES ($1, $2, $3, 'placed', $4)
RETURNING id;

-- Decrement batch remaining quantity (row-level lock)
UPDATE batches
SET remaining_quantity_kg = remaining_quantity_kg - $5,
    updated_at = NOW()
WHERE id = $6
  AND remaining_quantity_kg >= $5  -- ensures we don't go negative
  AND status IN ('listed', 'partially_sold')
RETURNING id;

-- If no rows returned from UPDATE: ROLLBACK + throw 409 Conflict (out of stock)

-- Insert order_items
INSERT INTO order_items (order_id, listing_id, batch_id, quantity_kg, price_per_kg_paise, subtotal_paise)
VALUES ($7, $8, $9, $10, $11, ROUND($10 * $11));

-- Hold escrow
INSERT INTO escrow_transactions (order_id, amount_paise, payment_reference)
VALUES ($12, $13, $14);

-- Update batch status if remaining_quantity_kg = 0
UPDATE batches SET status = 'sold', updated_at = NOW()
WHERE id = $6 AND remaining_quantity_kg = 0;
-- Else if > 0 and was 'listed', set to 'partially_sold'
UPDATE batches SET status = 'partially_sold', updated_at = NOW()
WHERE id = $6 AND remaining_quantity_kg > 0 AND status = 'listed';

COMMIT;
```

**Escrow release pattern (on DeliveredToConsumer BIR event):**
```sql
BEGIN;

-- Release escrow
UPDATE escrow_transactions
SET status = 'released',
    released_at = NOW(),
    release_triggered_by = 'BIR_EVENT'
WHERE order_id = $1 AND status = 'held'
RETURNING amount_paise;

-- Update order status
UPDATE orders SET status = 'delivered', actual_delivery_at = NOW()
WHERE id = $1;

-- Append EscrowReleased to BIR
INSERT INTO bir_events (batch_id, event_type, event_data, actor_id, actor_role)
VALUES ($2, 'EscrowReleased', $3, NULL, 'SYSTEM');

COMMIT;
```

**Edge case — open dispute blocks escrow release:**  
Before releasing escrow, check: `SELECT COUNT(*) FROM disputes WHERE order_id = $1 AND status NOT IN ('resolved','dismissed')`. If > 0, do NOT release. Return 409 with `{ code: 'OPEN_DISPUTE' }`.

---

### 18. `delivery_routes`
OR-Tools output: one route plan per delivery batch.

```sql
CREATE TABLE delivery_routes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name            VARCHAR(255),
  total_distance_km     DECIMAL(10, 2),
  estimated_duration_h  DECIMAL(6, 2),
  vehicle_type          VARCHAR(30) CHECK (vehicle_type IN ('DRY_VAN','COLD_VAN','MOTORCYCLE')),
  vehicle_id            VARCHAR(50),               -- logistics driver's vehicle registration
  driver_id             UUID REFERENCES users(id),
  optimized_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                VARCHAR(20) NOT NULL DEFAULT 'planned'
                          CHECK (status IN ('planned','in_progress','completed','cancelled')),
  baseline_distance_km  DECIMAL(10, 2),           -- what it would have been without optimization
  cost_estimate_paise   BIGINT,
  baseline_cost_paise   BIGINT,                   -- for IEI savings calculation
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 19. `route_stops`
Individual stops on a delivery route (ordered).

```sql
CREATE TABLE route_stops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id        UUID NOT NULL REFERENCES delivery_routes(id),
  order_id        UUID REFERENCES orders(id),      -- null for pickup stops
  stop_type       VARCHAR(20) NOT NULL CHECK (stop_type IN ('PICKUP','DELIVERY','HUB')),
  sequence_number INTEGER NOT NULL,
  location_name   VARCHAR(255),
  latitude        DECIMAL(10, 7) NOT NULL,
  longitude       DECIMAL(10, 7) NOT NULL,
  arrival_window_start TIMESTAMPTZ,
  arrival_window_end   TIMESTAMPTZ,
  actual_arrival_at    TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(route_id, sequence_number)
);

CREATE INDEX idx_route_stops_route ON route_stops(route_id, sequence_number ASC);
```

---

### 20. `temperature_logs`
IoT cold-chain temperature readings. Appended continuously during cold delivery.

```sql
CREATE TABLE temperature_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          UUID NOT NULL REFERENCES batches(id),
  route_id          UUID REFERENCES delivery_routes(id),
  temperature_c     DECIMAL(5, 2) NOT NULL,
  threshold_c       DECIMAL(5, 2) NOT NULL,
  breach_detected   BOOLEAN NOT NULL DEFAULT FALSE,
  vehicle_id        VARCHAR(50),
  location_lat      DECIMAL(10, 7),
  location_lng      DECIMAL(10, 7),
  logged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_temp_logs_batch ON temperature_logs(batch_id, logged_at ASC);
CREATE INDEX idx_temp_logs_breach ON temperature_logs(batch_id) WHERE breach_detected = TRUE;
```

**Edge case — temperature breach during delivery:**  
When `breach_detected = TRUE`:
1. Fire a `TemperatureBreachDetected` BIR event
2. Flag batch in review: `batches.status` stays `dispatched` but add `notes = 'TEMP_BREACH_REVIEW'`
3. Do NOT auto-fire `DeliveredToConsumer`; require ADMIN confirmation before escrow release
4. Notify driver and ops via notification record

---

### 21. `disputes`
Order disputes raised by buyers.

```sql
CREATE TABLE disputes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id),
  raised_by         UUID NOT NULL REFERENCES users(id),
  reason_category   VARCHAR(50) NOT NULL CHECK (reason_category IN (
    'QUALITY_MISMATCH',
    'QUANTITY_SHORT',
    'TEMPERATURE_BREACH',
    'WRONG_PRODUCT',
    'NOT_DELIVERED',
    'OTHER'
  )),
  description       TEXT NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','under_review','resolved','dismissed')),
  resolution        TEXT,
  resolved_by       UUID REFERENCES users(id),    -- admin
  resolved_at       TIMESTAMPTZ,
  refund_amount_paise BIGINT DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_order ON disputes(order_id);
CREATE INDEX idx_disputes_status ON disputes(status);
```

**Dispute window:** Buyer can raise a dispute only within 48 hours of `orders.actual_delivery_at`.  
Enforce in service layer: `NOW() - actual_delivery_at <= INTERVAL '48 hours'`.

---

### 22. `dispute_evidence`
Evidence attached to a dispute (BIR events, photos, documents).

```sql
CREATE TABLE dispute_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id      UUID NOT NULL REFERENCES disputes(id),
  evidence_type   VARCHAR(30) NOT NULL CHECK (evidence_type IN ('BIR_EVENT','PHOTO','DOCUMENT','BIR_SNAPSHOT')),
  bir_event_id    UUID REFERENCES bir_events(id),  -- for BIR_EVENT type
  file_url        TEXT,                             -- for PHOTO/DOCUMENT type
  description     TEXT,
  submitted_by    UUID REFERENCES users(id),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 23. `demand_forecasts`
AI model output. Cached results, refreshed every 6 hours via cron.

```sql
CREATE TABLE demand_forecasts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_type         VARCHAR(100) NOT NULL,
  city              VARCHAR(100) NOT NULL,
  forecast_date     DATE NOT NULL,                  -- the date being forecast
  predicted_kg      DECIMAL(10, 2) NOT NULL,
  confidence_pct    DECIMAL(5, 2) NOT NULL,         -- 0–100
  range_low_kg      DECIMAL(10, 2) NOT NULL,
  range_high_kg     DECIMAL(10, 2) NOT NULL,
  demand_drivers    JSONB NOT NULL DEFAULT '[]',     -- [{ factor, contribution_pct }]
  model_version     VARCHAR(50) NOT NULL,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(crop_type, city, forecast_date, model_version)
);

CREATE INDEX idx_demand_crop_city ON demand_forecasts(crop_type, city, forecast_date DESC);
```

**Cold start edge case:** If a crop+city combination has < 90 days of historical data, use regional crop category averages and set `confidence_pct < 55`. Flag with `demand_drivers` entry: `{ "factor": "cold_start_regional_average", "contribution_pct": 100 }`.

---

### 24. `price_intelligence`
Price recommendations per batch quality + crop + destination.

```sql
CREATE TABLE price_intelligence (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_type                 VARCHAR(100) NOT NULL,
  quality_score_band        VARCHAR(20) NOT NULL CHECK (quality_score_band IN ('PREMIUM','STANDARD','ECONOMY')),
  -- PREMIUM: score >= 90, STANDARD: 70-89, ECONOMY: <70
  destination_city          VARCHAR(100) NOT NULL,
  commodity_price_paise     BIGINT NOT NULL,   -- eNAM reference price at time of calculation
  recommended_low_paise     BIGINT NOT NULL,
  recommended_high_paise    BIGINT NOT NULL,
  premium_pct               DECIMAL(5, 2) NOT NULL,  -- % above commodity price
  buyer_acceptance_prob     DECIMAL(5, 2),            -- 0–100; probability buyer accepts this range
  model_version             VARCHAR(50) NOT NULL,
  generated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_intel_lookup ON price_intelligence(crop_type, quality_score_band, destination_city, generated_at DESC);
```

---

### 25. `simulation_runs`
What-if simulator inputs and outputs. Stored for audit trail.

```sql
CREATE TABLE simulation_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_by            UUID REFERENCES users(id),
  input_params      JSONB NOT NULL,           -- { demand_spike_pct, supply_disruption_pct, crop_type, city }
  output_results    JSONB NOT NULL,           -- { shortage_kg, alternate_fpos, recommended_price_adjustment, route_changes, farmer_realization_change_pct, logistics_cost_change_pct }
  run_duration_ms   INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 26. `fpo_trust_scores`
Computed trust scores for FPOs. Refreshed nightly.

```sql
CREATE TABLE fpo_trust_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fpo_id                UUID NOT NULL REFERENCES fpo_profiles(id),
  fulfillment_rate      DECIMAL(5, 2),    -- % of contracted quantity actually delivered
  quality_consistency   DECIMAL(5, 2),    -- % of batches passing quality at first test
  on_time_delivery_rate DECIMAL(5, 2),
  dispute_rate          DECIMAL(5, 2),    -- disputes as % of total orders
  buyer_rating_avg      DECIMAL(3, 2),    -- avg buyer rating 1–5
  total_batches         INTEGER,
  computed_score        DECIMAL(5, 2),    -- weighted composite 0–100
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_fpo ON fpo_trust_scores(fpo_id, computed_at DESC);
```

**Score formula (document this in `docs/research/trust-score-formula.md`):**
```
computed_score =
  (fulfillment_rate * 0.30) +
  (quality_consistency * 0.25) +
  (on_time_delivery_rate * 0.20) +
  ((100 - dispute_rate) * 0.15) +
  (buyer_rating_avg * 20 * 0.10)
```

---

### 27. `buyer_reliability_scores`
Computed reliability scores for bulk buyers.

```sql
CREATE TABLE buyer_reliability_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id              UUID NOT NULL REFERENCES users(id),
  payment_reliability   DECIMAL(5, 2),    -- % of escrow transactions settled without issue
  order_accuracy        DECIMAL(5, 2),    -- % of orders not cancelled post-confirmation
  cancellation_rate     DECIMAL(5, 2),
  dispute_rate          DECIMAL(5, 2),
  computed_score        DECIMAL(5, 2),
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 28. `whatsapp_sessions`
WhatsApp bot conversation state machine for farmers.

```sql
CREATE TABLE whatsapp_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(15) NOT NULL UNIQUE,
  user_id         UUID REFERENCES users(id),       -- null if unregistered
  state           VARCHAR(50) NOT NULL DEFAULT 'greeting',
  -- States: greeting, awaiting_intent, batch_query, price_query, demand_query, order_status, support
  context_data    JSONB NOT NULL DEFAULT '{}',      -- conversation context between turns
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_phone ON whatsapp_sessions(phone);
```

**Session timeout:** If `session_expires_at < NOW()`, reset state to `greeting` and clear `context_data`. Farmer starts fresh.

---

### 29. `notifications`
In-app notification system. All roles.

```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(50) NOT NULL,   -- 'BATCH_TEST_RESULT','ORDER_UPDATE','DEMAND_ALERT','TEMP_BREACH', etc.
  title           VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',     -- e.g. { batch_id, order_id }
  read_at         TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
```

---

### 30. `audit_logs`
System-wide audit trail. Never deleted.

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES users(id),
  actor_role      VARCHAR(20),
  action          VARCHAR(100) NOT NULL,  -- e.g. 'BATCH_STATUS_CHANGE', 'ESCROW_RELEASED'
  entity_type     VARCHAR(50),            -- 'batch', 'order', 'user'
  entity_id       UUID,
  old_value       JSONB,
  new_value       JSONB,
  ip_address      VARCHAR(45),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
```

---

## KEY SQL PATTERNS

### Pattern 1 — Get full BIR for a batch (public QR view)
```sql
SELECT
  b.batch_code,
  b.crop_type,
  b.harvest_date,
  b.quality_score,
  b.status,
  c.name AS cluster_name,
  c.district,
  c.state,
  c.latitude,
  c.longitude,
  fp.full_name AS farmer_name,
  fpo.fpo_name,
  qt.tier AS test_tier,
  qt.result AS test_result,
  qt.purity_score,
  qt.test_parameters,
  qc.cert_url,
  qc.cert_number,
  COALESCE(
    json_agg(
      json_build_object(
        'event_type', be.event_type,
        'event_data', be.event_data,
        'created_at', be.created_at
      ) ORDER BY be.created_at ASC
    ) FILTER (WHERE be.id IS NOT NULL),
    '[]'
  ) AS bir_events
FROM batches b
JOIN clusters c ON c.id = b.cluster_id
LEFT JOIN farmer_profiles fp_prof ON fp_prof.id = b.farmer_id
LEFT JOIN users fp ON fp.id = fp_prof.user_id
LEFT JOIN fpo_profiles fpo ON fpo.id = b.fpo_id
LEFT JOIN quality_tests qt ON qt.batch_id = b.id AND qt.result = 'PASS'
  AND qt.id = (SELECT id FROM quality_tests WHERE batch_id = b.id AND result = 'PASS' ORDER BY created_at DESC LIMIT 1)
LEFT JOIN quality_certificates qc ON qc.quality_test_id = qt.id
LEFT JOIN bir_events be ON be.batch_id = b.id
WHERE b.qr_hash = $1 AND b.deleted_at IS NULL
GROUP BY b.id, c.id, fp.id, fp_prof.id, fpo.id, qt.id, qc.id;
```

### Pattern 2 — Demand-matched listings for a city (marketplace browse)
```sql
SELECT
  l.id AS listing_id,
  l.price_per_kg_paise,
  l.available_until,
  l.listing_type,
  b.batch_code,
  b.crop_type,
  b.quality_score,
  b.remaining_quantity_kg,
  b.harvest_date,
  c.district,
  c.state,
  fpo.fpo_name,
  fps.computed_score AS fpo_trust_score,
  qc.cert_url IS NOT NULL AS has_nabl_cert,
  df.predicted_kg AS demand_forecast_kg,
  df.confidence_pct AS demand_confidence
FROM listings l
JOIN batches b ON b.id = l.batch_id
JOIN clusters c ON c.id = b.cluster_id
LEFT JOIN fpo_profiles fpo ON fpo.id = b.fpo_id
LEFT JOIN fpo_trust_scores fps ON fps.fpo_id = fpo.id
  AND fps.computed_at = (SELECT MAX(computed_at) FROM fpo_trust_scores WHERE fpo_id = fpo.id)
LEFT JOIN quality_certificates qc ON qc.batch_id = b.id
LEFT JOIN demand_forecasts df ON df.crop_type = b.crop_type
  AND df.city = $2
  AND df.forecast_date = CURRENT_DATE
WHERE l.status = 'active'
  AND l.deleted_at IS NULL
  AND b.deleted_at IS NULL
  AND b.status IN ('listed', 'partially_sold')
  AND ($1::text IS NULL OR b.crop_type = $1)  -- optional crop filter
ORDER BY fps.computed_score DESC NULLS LAST, b.quality_score DESC NULLS LAST
LIMIT $3 OFFSET $4;
```

### Pattern 3 — Allocation under shortage (allocation engine)
```sql
-- Given: shortage scenario, priority-order buyers for a batch
SELECT
  o.id AS order_id,
  o.buyer_id,
  oi.quantity_kg AS requested_kg,
  o.created_at,
  brs.computed_score AS buyer_reliability,
  u.role AS buyer_role,
  oi.id AS order_item_id
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN users u ON u.id = o.buyer_id
LEFT JOIN buyer_reliability_scores brs ON brs.buyer_id = o.buyer_id
  AND brs.computed_at = (SELECT MAX(computed_at) FROM buyer_reliability_scores WHERE buyer_id = o.buyer_id)
WHERE oi.batch_id = $1
  AND o.status = 'allocation_pending'
ORDER BY
  brs.computed_score DESC NULLS LAST,  -- priority 1: reliability score
  o.created_at ASC                     -- priority 2: FIFO (deterministic tie-breaking)
FOR UPDATE SKIP LOCKED;
-- FOR UPDATE SKIP LOCKED: concurrent allocation engine runs skip already-locked rows
```

### Pattern 4 — IEI computation for dashboard
```sql
SELECT
  COUNT(o.id) AS total_orders,
  ROUND(AVG(
    (oi.price_per_kg_paise::DECIMAL / 100) -    -- BharatPure price
    (COALESCE(pi.commodity_price_paise, 0)::DECIMAL / 100)  -- commodity baseline
  ), 2) AS avg_farmer_premium_rupees,
  ROUND(AVG(dr.baseline_distance_km - dr.total_distance_km), 2) AS avg_distance_saved_km,
  ROUND(AVG(
    (dr.baseline_cost_paise - dr.cost_estimate_paise)::DECIMAL / 100
  ), 2) AS avg_logistics_saving_rupees,
  COUNT(CASE WHEN o.status = 'delivered' AND o.actual_delivery_at - o.created_at < INTERVAL '24 hours' THEN 1 END) AS settled_under_24h
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN price_intelligence pi ON pi.crop_type = (SELECT crop_type FROM batches WHERE id = oi.batch_id)
  AND pi.generated_at > NOW() - INTERVAL '7 days'
LEFT JOIN delivery_routes dr ON dr.id = (
  SELECT id FROM delivery_routes WHERE status = 'completed'
  ORDER BY completed_at DESC LIMIT 1
)
WHERE o.created_at > NOW() - INTERVAL '30 days';
```

### Pattern 5 — Farmer earnings summary
```sql
SELECT
  u.full_name,
  fp.total_batches,
  fp.fulfillment_rate,
  SUM(oi.subtotal_paise) AS total_earned_paise,
  COUNT(DISTINCT o.id) AS total_orders_fulfilled,
  AVG(b.quality_score) AS avg_quality_score,
  SUM(fp.quality_premium_earned_paise) AS total_premium_earned_paise
FROM users u
JOIN farmer_profiles fp ON fp.user_id = u.id
JOIN batches b ON b.farmer_id = fp.id
JOIN order_items oi ON oi.batch_id = b.id
JOIN orders o ON o.id = oi.order_id AND o.status = 'delivered'
WHERE u.id = $1
GROUP BY u.id, fp.id;
```

---

## EDGE CASES — COMPREHENSIVE CATALOGUE

Document each of these in `docs/research/edge-cases.md` and add a code comment wherever the mitigation is implemented.

| ID | Edge Case | Where It Hits | Mitigation |
|---|---|---|---|
| EC-01 | Concurrent orders exhaust batch stock | Order create | `FOR UPDATE` on batch + atomic decrement + check remaining >= 0 in same TX |
| EC-02 | OTP timing attack (enumerate valid OTPs) | Auth/verify-otp | bcrypt hash of OTP, not plaintext; 5-attempt lockout; 1 OTP per 60s |
| EC-03 | QR scanned and burned by wrong person | QR/burn | Require auth for burn; log actor_id on BIR event; unique constraint prevents double-burn |
| EC-04 | Temperature breach mid-delivery | Logistics | Breach → BIR event → flag batch → block auto-escrow-release → require admin override |
| EC-05 | JWT expires during long form session | All protected routes | Axios interceptor auto-refreshes on 401 before retrying original request |
| EC-06 | Farmer creates batch exceeding contract qty | Batch create | Validate against contract's committed_quantity vs remaining; warn if >20% discrepancy |
| EC-07 | FPO has no AgriStack ID | Farmer register | `agristack_farmer_id` nullable; platform works without it; show "Verify with AgriStack" nudge |
| EC-08 | AI model cold start (< 90 days data) | Demand forecast | Use regional crop averages; confidence_pct capped at 55; flag in demand_drivers |
| EC-09 | Dispute raised after escrow released | Dispute create | Check order status = 'delivered' AND actual_delivery_at within 48h; if escrow already released, dispute triggers refund flow |
| EC-10 | Consumer accidentally burns QR before opening | QR/burn | Burn is shown as confirmation dialog ("This cannot be undone. Are you sure you've opened the package?"); idempotent — second burn attempt returns 409 |
| EC-11 | Multiple allocation engine runs on same order | Allocation | `FOR UPDATE SKIP LOCKED` prevents double-allocation; idempotent order status check |
| EC-12 | Price changes after order placed | Order/price | `price_per_kg_paise` in order_items locked at order time; never recomputed from current listing price |
| EC-13 | Negative remaining_quantity_kg | Batch/order | DB-level: `CHECK (remaining_quantity_kg >= 0)` on batches table |
| EC-14 | WhatsApp session expiry mid-conversation | WhatsApp bot | Check `session_expires_at` on every incoming message; reset gracefully with "Let's start again" message |
| EC-15 | NABL certificate upload fails mid-process | File upload | Multer temp file; only link to BIR event after DB record created; cleanup temp on failure |
| EC-16 | Demand forecast stale (AI service down) | Demand API | Return last cached forecast from DB with `{ stale: true, generated_at: ... }` flag; never 500 |
| EC-17 | OR-Tools routing timeout (too many stops) | Route optimize | Set 30s solver time limit; return best solution found; log if sub-optimal |
| EC-18 | Bulk order partial fulfillment (not enough stock) | Bulk order | Show buyer maximum available qty; offer partial order with buyer confirmation |
| EC-19 | Escrow release blocked by open dispute | Escrow release | Check for open disputes before release; notify ops; do not release until dispute resolved |
| EC-20 | Refresh token replay (stolen cookie) | Auth/refresh | Token rotation: revoke old on use; if revoked token reused → revoke ALL user tokens → force re-login |
| EC-21 | FPO registers same batch twice (duplicate submission) | Batch create | `batch_code` UNIQUE constraint catches; return 409 with `{ code: 'BATCH_ALREADY_EXISTS' }` |
| EC-22 | Admin marks batch delivered manually (dispute outcome) | Admin | Escrow release with `release_triggered_by = 'MANUAL_ADMIN'`; audit log mandatory |
| EC-23 | Logistics driver loses GPS mid-route | Temperature log | GPS fields in temperature_logs are nullable; log without coordinates; don't break the flow |
| EC-24 | eNAM mock data file missing | Price intelligence | Fallback to last DB-cached price_intelligence row; log error; never 500 to client |
| EC-25 | ADMIN_REGISTRATION_CODE not set in env | Admin register | If env var undefined: return 500 with `{ code: 'SERVER_MISCONFIGURATION' }` — do not register the admin |

Add `CHECK (remaining_quantity_kg >= 0)` to batches table migration to enforce EC-13 at DB level.

---

*End of BHARATPURE-DB.md — Batch 2 of 5*
*Next: BHARATPURE-API.md — every route, exact request/response shapes, controller patterns*
