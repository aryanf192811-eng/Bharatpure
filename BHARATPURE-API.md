# BHARATPURE-API.md — Complete API Contract
> Every route. Every shape. Every status code. Frozen.
> Claude Code: read this file entirely before writing a single route handler.
> Plan your implementation. State your edge cases. Then code.

---

## CORE CONVENTIONS

### URL Structure
```
/api/auth/...           — authentication (no role guard)
/api/users/...          — current user profile
/api/farmers/...        — FARMER role operations
/api/clusters/...       — cluster management
/api/contracts/...      — procurement contracts
/api/batches/...        — batch lifecycle
/api/quality/...        — testing and certificates
/api/listings/...       — marketplace listings
/api/orders/...         — buyer orders
/api/escrow/...         — escrow operations (ADMIN only + system)
/api/logistics/...      — LOGISTICS role operations
/api/demand/...         — AI demand intelligence
/api/price/...          — AI price intelligence
/api/simulation/...     — what-if simulator
/api/qr/...             — QR generation and scanning
/api/disputes/...       — dispute management
/api/notifications/...  — in-app notifications
/api/admin/...          — ADMIN only
/api/dpi/...            — DPI integration mock endpoints
/api/webhooks/...       — external webhooks (Twilio)
```

### HTTP Verbs
| Verb | Use case | Idempotent |
|---|---|---|
| GET | Read — never changes state | Yes |
| POST | Create a resource / trigger an action | No |
| PUT | Replace a resource completely | Yes |
| PATCH | Partial update of a resource | Yes |
| DELETE | Remove (soft delete) | Yes |

Never use GET to create, mutate, or trigger side effects. Never use POST for reads.

### Status Code Table (nothing outside this list without a written reason)
| Code | When |
|---|---|
| 200 | Successful GET / PATCH / PUT |
| 201 | Successful POST that created a resource |
| 204 | Successful DELETE (no body) |
| 400 | Bad request — malformed JSON, missing required field, type mismatch |
| 401 | Unauthenticated — no token, expired token, invalid token |
| 403 | Forbidden — valid token but wrong role, account suspended, action not permitted |
| 404 | Resource not found |
| 409 | Conflict — duplicate entry, race condition (out of stock), invalid state transition |
| 422 | Unprocessable — valid format but business rule violation (e.g. batch in wrong status) |
| 429 | Rate limited |
| 500 | Unhandled server error — never leak stack traces |

---

## RESPONSE WRAPPER — FROZEN SHAPES

Every response uses one of these three shapes. Nothing else.

```ts
// Success (200, 201)
{
  success: true,
  data: T,           // the actual payload
  message?: string   // optional human-readable string (useful for mutations)
}

// Error (4xx, 5xx)
{
  success: false,
  error: {
    code: string,        // machine-readable, SCREAMING_SNAKE_CASE e.g. 'BATCH_NOT_FOUND'
    message: string,     // human-readable
    details?: any[]      // Zod validation errors, field-level info
  }
}

// Paginated list (200)
{
  success: true,
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

**Backend helper (create once, import everywhere):**
```js
// backend/src/utils/response.js
const sendSuccess = (res, data, statusCode = 200, message) =>
  res.status(statusCode).json({ success: true, data, ...(message && { message }) });

const sendError = (res, statusCode, code, message, details) =>
  res.status(statusCode).json({ success: false, error: { code, message, ...(details && { details }) } });

const sendPaginated = (res, data, page, limit, total) =>
  res.status(200).json({
    success: true, data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
```

---

## CONTROLLER TEMPLATE

Every controller follows this exact pattern. No exceptions.

```js
// backend/src/controllers/{domain}.controller.js
const { z } = require('zod');
const logger = require('../utils/logger');

const doSomething = async (req, res, next) => {
  // 1. VALIDATE INPUT
  const schema = z.object({ field: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.errors);
  }

  // 2. PERSIST / BUSINESS LOGIC
  try {
    const result = await someService.doSomething(parsed.data, req.user);

    // 3. SIDE EFFECTS (notifications, BIR events, cron triggers)
    //    Fire-and-forget side effects AFTER the main operation succeeds
    //    Never let a side effect failure roll back the main operation
    //    unless the side effect is transactional (e.g., BIR event in same TX)

    // 4. LOG
    logger.info({ action: 'SOMETHING_DONE', userId: req.user.id, result: result.id });

    // 5. RESPOND
    return sendSuccess(res, result, 201, 'Done successfully');
  } catch (err) {
    logger.error({ action: 'SOMETHING_FAILED', userId: req.user?.id, err: err.message });
    return next(err); // global error handler takes over
  }
};
```

**Global error handler (must be the last middleware in app.js):**
```js
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  logger.error({ err: err.message, stack: err.stack });
  // Never send stack trace to client in production
  sendError(res, statusCode, code, err.message || 'An unexpected error occurred');
});
```

---

## FRONTEND API LAYER PATTERN

```ts
// frontend/src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,  // sends HttpOnly refresh token cookie automatically
});

// REQUEST: attach access token from Zustand auth store
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// RESPONSE: auto-refresh on 401, retry once
let isRefreshing = false;
let failedQueue: any[] = [];

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        });
      }
      isRefreshing = true;
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);
        failedQueue.forEach(({ resolve }) => resolve(newToken));
        failedQueue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch {
        failedQueue.forEach(({ reject }) => reject(error));
        failedQueue = [];
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default client;
```

```ts
// frontend/src/api/{domain}.api.ts — one file per domain, never call client inside a component
// All functions return the unwrapped `data` field from the response wrapper

// Example: frontend/src/api/batch.api.ts
import client from './client';

export const batchApi = {
  list: (params?: { status?: string; crop_type?: string; page?: number }) =>
    client.get('/api/batches', { params }).then(r => r.data),

  getById: (id: string) =>
    client.get(`/api/batches/${id}`).then(r => r.data),

  create: (payload: CreateBatchPayload) =>
    client.post('/api/batches', payload).then(r => r.data),
};
```

TanStack Query wraps every API call. Never call API functions directly from a component body.

---

## POSTMAN COLLECTION STRUCTURE

```
backend/postman/-collection.json
└── BharatPure API
    ├── Auth
    │   ├── POST Register - Farmer
    │   ├── POST Register - Consumer
    │   ├── POST Register - Bulk Buyer
    │   ├── POST Register - Logistics
    │   ├── POST Register - Admin
    │   ├── POST Login
    │   ├── POST Verify OTP
    │   ├── POST Forgot Password
    │   ├── POST Verify Reset OTP
    │   ├── POST Reset Password
    │   ├── POST Refresh Token
    │   └── POST Logout
    ├── Batches
    ├── Quality
    ├── Listings
    ├── Orders
    ├── Logistics
    ├── Demand Intelligence
    ├── Price Intelligence
    ├── Simulation
    ├── QR
    ├── Disputes
    ├── Admin
    └── DPI Mock

backend/postman/-environment.json
{
  "values": [
    { "key": "baseUrl", "value": "http://localhost:5000", "enabled": true },
    { "key": "authToken", "value": "", "enabled": true },
    { "key": "farmerToken", "value": "", "enabled": true },
    { "key": "consumerToken", "value": "", "enabled": true },
    { "key": "adminToken", "value": "", "enabled": true }
  ]
}
```

Every route gets added to this collection as it ships. Every auth test sets `{{authToken}}` via a post-response script.

---

## ROUTE REFERENCE — ALL ROUTES

---

### GROUP 1 — AUTH `/api/auth`

#### POST `/api/auth/register`
**Auth:** None  
**Body:**
```json
{
  "phone": "9876543210",
  "password": "Secure@123",
  "full_name": "Ravi Patil",
  "role": "FARMER",
  "email": "ravi@example.com",
  "fpo_name": "Sangli Turmeric FPO",
  "registration_number": "MH-FPO-2021-0041",
  "state": "Maharashtra",
  "district": "Sangli",
  "primary_crop_types": ["TURMERIC"],
  "agristack_farmer_id": "AGS-2026-MH-00041"
}
```
Fields beyond `phone`, `password`, `full_name`, `role` are role-specific (Zod discriminated union per role).  
**Success 201:**
```json
{ "success": true, "data": { "userId": "uuid", "devOtp": "423819" }, "message": "OTP sent to your phone." }
```
**Errors:**
- `400 VALIDATION_ERROR` — invalid phone format, weak password, missing role-required fields
- `409 PHONE_ALREADY_EXISTS` — phone is taken
- `409 EMAIL_ALREADY_EXISTS` — email is taken
- `409 REGISTRATION_NUMBER_TAKEN` — FPO reg number duplicate

**Password rules (enforce via Zod):** min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char.  
**Phone validation:** exactly 10 digits, no country code stored (add +91 internally for WhatsApp).

---

#### POST `/api/auth/verify-otp`
**Auth:** None  
**Body:** `{ "phone": "9876543210", "otp": "423819", "purpose": "registration" }`  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "user": { "id": "uuid", "role": "FARMER", "full_name": "Ravi Patil", "status": "active" }
  }
}
```
Refresh token set as HttpOnly cookie `refreshToken`.  
**Errors:**
- `400 OTP_INVALID` — hash mismatch
- `400 OTP_EXPIRED` — past expires_at
- `429 TOO_MANY_ATTEMPTS` — 5+ failed attempts in 15 min
- `404 USER_NOT_FOUND`

---

#### POST `/api/auth/login`
**Auth:** None  
**Body:** `{ "identifier": "9876543210", "password": "Secure@123" }` — identifier = phone or email  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "user": { "id": "uuid", "role": "FARMER", "full_name": "Ravi Patil", "status": "active" }
  }
}
```
**Errors:**
- `401 INVALID_CREDENTIALS`
- `403 OTP_REQUIRED` — status is 'pending'
- `403 ACCOUNT_SUSPENDED`
- `429 TOO_MANY_ATTEMPTS` — 10 failed logins in 15 min

---

#### POST `/api/auth/forgot-password`
**Auth:** None  
**Body:** `{ "phone": "9876543210" }`  
**Success 200:**
```json
{ "success": true, "data": { "devOtp": "719204" }, "message": "Reset OTP sent." }
```
**Errors:**
- `404 USER_NOT_FOUND`
- `429 OTP_COOLDOWN` — requested OTP within last 60 seconds

---

#### POST `/api/auth/verify-reset-otp`
**Auth:** None  
**Body:** `{ "phone": "9876543210", "otp": "719204" }`  
**Success 200:**
```json
{ "success": true, "data": { "resetToken": "eyJ..." } }
```
`resetToken` is a short-lived JWT (5min, purpose: 'password_reset'). Send in Authorization header for reset-password.

---

#### POST `/api/auth/reset-password`
**Auth:** Bearer resetToken  
**Body:** `{ "newPassword": "NewSecure@456" }`  
**Success 200:** `{ "success": true, "data": null, "message": "Password reset successful." }`  
**Errors:**
- `401 INVALID_RESET_TOKEN`
- `400 SAME_AS_OLD_PASSWORD` — bcrypt compare with current hash; reject if same

---

#### POST `/api/auth/refresh`
**Auth:** HttpOnly cookie `refreshToken`  
**Body:** none  
**Success 200:** `{ "success": true, "data": { "accessToken": "eyJ..." } }`  
**Errors:**
- `401 REFRESH_TOKEN_INVALID`
- `401 REFRESH_TOKEN_EXPIRED`
- `401 REFRESH_TOKEN_REVOKED` — token was already used (rotation); all tokens for user revoked

---

#### POST `/api/auth/logout`
**Auth:** Bearer accessToken  
**Body:** none  
**Success 204:** no body  
Revokes the refresh token (sets `revoked_at = NOW()`). Clears cookie.

---

### GROUP 2 — USERS `/api/users`

#### GET `/api/users/me`
**Auth:** Any authenticated role  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "9876543210",
    "email": "ravi@example.com",
    "full_name": "Ravi Patil",
    "role": "FARMER",
    "status": "active",
    "profile": { /* role-specific profile data */ }
  }
}
```

#### PATCH `/api/users/me`
**Auth:** Any authenticated role  
**Body:** `{ "full_name": "Ravi R. Patil", "email": "new@email.com" }`  
Only `full_name` and `email` are updatable by the user. Phone and role are immutable.  
**Success 200:** Updated user object.  
**Errors:** `409 EMAIL_ALREADY_EXISTS`

#### GET `/api/users/me/notifications`
**Auth:** Any authenticated role  
**Query:** `?unread_only=true&page=1&limit=20`  
**Success 200:** Paginated notification list.

---

### GROUP 3 — FARMERS `/api/farmers`

#### GET `/api/farmers/profile`
**Auth:** FARMER  
**Success 200:** Full farmer/FPO profile including cluster, trust score, earnings summary.

#### PATCH `/api/farmers/profile`
**Auth:** FARMER  
**Body:** Updatable profile fields: `land_gps_lat`, `land_gps_lng`, `land_area_acres`, `primary_crop`, `agristack_farmer_id`  
**Success 200:** Updated profile.

#### GET `/api/farmers/dashboard`
**Auth:** FARMER  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "active_batches": 3,
    "pending_payments_paise": 450000,
    "total_earned_paise": 2800000,
    "trust_score": 88.4,
    "demand_signals": [
      { "crop_type": "TURMERIC", "city": "Delhi", "predicted_kg": 4832, "confidence_pct": 84, "demand_delta_pct": 18 }
    ],
    "recent_batches": [ /* last 5 batches */ ],
    "active_contracts": 2
  }
}
```

#### GET `/api/farmers/earnings`
**Auth:** FARMER  
**Query:** `?from=2026-01-01&to=2026-09-30`  
**Success 200:** Detailed earnings breakdown per batch.

#### GET `/api/farmers/trust-score`
**Auth:** FARMER  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "computed_score": 88.4,
    "fulfillment_rate": 94.2,
    "quality_consistency": 91.0,
    "on_time_delivery_rate": 86.5,
    "dispute_rate": 2.1,
    "buyer_rating_avg": 4.6,
    "computed_at": "2026-09-06T00:00:00Z"
  }
}
```

#### GET `/api/clusters`
**Auth:** FARMER, ADMIN  
**Query:** `?state=Maharashtra&crop_type=TURMERIC`  
**Success 200:** Paginated cluster list.

#### GET `/api/clusters/:clusterId`
**Auth:** FARMER, ADMIN  
**Success 200:** Cluster details with member count and recent batch stats.

---

### GROUP 4 — CONTRACTS `/api/contracts`

#### GET `/api/contracts`
**Auth:** FARMER, ADMIN  
**Query:** `?status=active&page=1&limit=10`  
**Success 200:** Paginated contract list for the authenticated FPO.

#### POST `/api/contracts`
**Auth:** FARMER  
**Body:**
```json
{
  "cluster_id": "uuid",
  "crop_type": "TURMERIC",
  "quantity_kg": 2500,
  "price_floor_paise": 14000,
  "price_ceiling_paise": 21000,
  "sowing_date": "2026-10-15",
  "expected_harvest_date": "2027-01-20"
}
```
**Success 201:** Created contract.  
**Errors:**
- `400 VALIDATION_ERROR` — price_floor > price_ceiling, invalid dates, sowing_date in past
- `422 FPO_NOT_REGISTERED` — user is FARMER but has no fpo_profile

#### GET `/api/contracts/:contractId`
**Auth:** FARMER (own contracts), ADMIN  
**Success 200:** Full contract with cluster and batch linkage.

#### PATCH `/api/contracts/:contractId/status`
**Auth:** ADMIN  
**Body:** `{ "status": "cancelled", "reason": "FPO requested cancellation" }`  
Valid transitions: `active → cancelled`, `active → defaulted`.  
**Success 200:** Updated contract.

---

### GROUP 5 — BATCHES `/api/batches`

#### POST `/api/batches`
**Auth:** FARMER  
**Body:**
```json
{
  "cluster_id": "uuid",
  "contract_id": "uuid",
  "crop_type": "TURMERIC",
  "harvest_date": "2026-09-05",
  "total_quantity_kg": 2500.0,
  "notes": "Late monsoon harvest, slightly darker color"
}
```
Creates batch with `status: 'draft'`. Auto-generates `batch_code` and `qr_hash`.  
Appends `BatchCreated` and `HarvestDataLogged` BIR events in same transaction.  
**Success 201:** Full batch object with `batch_code` and `qr_hash`.  
**Errors:**
- `409 BATCH_CODE_CONFLICT` — race on batch_code generation (retry once)
- `422 QUANTITY_EXCEEDS_CONTRACT` — total_quantity_kg > contract remaining; warn if > 20% over

#### GET `/api/batches`
**Auth:** FARMER (own), ADMIN (all), BULK_BUYER (listed only), CONSUMER (listed only)  
**Query:** `?status=listed&crop_type=TURMERIC&page=1&limit=20&sort=quality_score_desc`  
FARMER sees own batches. BULK_BUYER and CONSUMER see only `status IN ('listed','partially_sold')`.  
**Success 200:** Paginated list with quality summary, cluster, FPO trust score.

#### GET `/api/batches/:batchId`
**Auth:** FARMER (own), ADMIN, BULK_BUYER, CONSUMER  
**Success 200:** Full batch with latest quality test, BIR event log, certificate URL.

#### GET `/api/batches/:batchId/bir`
**Auth:** Public (no auth required) — this is the QR-scan public view  
**Success 200:** Full BIR event log, quality data, farmer info. No price or order data.

#### PATCH `/api/batches/:batchId/status`
**Auth:** FARMER (own batch), ADMIN  
**Body:** `{ "status": "pending_test" }`  
Validates against state machine. `draft → pending_test` only.  
Appends `ProcessingStarted` BIR event.  
**Success 200:** Updated batch.  
**Errors:** `422 INVALID_STATUS_TRANSITION`

#### DELETE `/api/batches/:batchId`
**Auth:** FARMER (own), ADMIN  
Soft delete. Only allowed when `status IN ('draft', 'test_failed')`. Cannot delete a listed or sold batch.  
**Success 204:** No body.  
**Errors:** `422 BATCH_CANNOT_BE_DELETED`

---

### GROUP 6 — QUALITY `/api/quality`

#### POST `/api/quality/tests`
**Auth:** FARMER, ADMIN  
**Body:**
```json
{
  "batch_id": "uuid",
  "tier": "TIER1",
  "result": "PASS",
  "purity_score": 94.0,
  "test_parameters": {
    "curcumin_pct": 3.8,
    "lead_ppm": 0.12,
    "pesticide_residue": "ND",
    "moisture_pct": 8.5
  },
  "lab_name": null,
  "tested_by": "uuid"
}
```
On PASS: appends `RapidTestPassed` or `NABLCertificateLinked` BIR event; updates `batches.quality_score`.  
On FAIL: appends `RapidTestFailed`; creates `b_sample_requests` record if TIER1 fail.  
On TIER2 FAIL: sets `batches.status = 'test_failed'`; appends `BatchRejected` BIR event; fires notification to FPO.  
**Success 201:** Created quality test.  
**Errors:**
- `404 BATCH_NOT_FOUND`
- `422 BATCH_WRONG_STATUS` — batch must be `pending_test`
- `400 INVALID_TIER2_WITHOUT_TIER1` — TIER2 requires a TIER1 PASS first

#### POST `/api/quality/certificates`
**Auth:** FARMER, ADMIN  
**Body:** multipart/form-data: `batch_id`, `quality_test_id`, `cert_number`, `issued_at`, `file` (PDF max 5MB)  
Validates MIME type, file size. Saves to `LOCAL_STORAGE_PATH` or S3. Creates DB record. Appends `NABLCertificateLinked` BIR event.  
**Success 201:** Certificate record with `cert_url`.  
**Errors:**
- `400 INVALID_MIME_TYPE` — not application/pdf
- `400 FILE_TOO_LARGE` — > 5MB
- `409 CERT_NUMBER_EXISTS`

#### GET `/api/quality/batches/:batchId/tests`
**Auth:** FARMER (own), ADMIN, BULK_BUYER, CONSUMER  
**Success 200:** All test results for this batch, ordered by created_at DESC.

#### GET `/api/quality/certificates/:certId/download`
**Auth:** Any authenticated  
Streams the PDF. Sets `Content-Disposition: attachment`.

#### GET `/api/quality/b-samples/:batchId`
**Auth:** FARMER (own), ADMIN  
**Success 200:** B-sample request details if exists.

#### POST `/api/quality/b-samples/:batchId/request`
**Auth:** FARMER (own batch)  
Body: `{ "selected_lab": "NABL Referee Lab, Pune" }`  
Only valid if B-sample window is open (`request_window_end > NOW()`).  
Updates b_sample_requests status to `lab_selected`.  
**Success 200:** Updated B-sample record.  
**Errors:**
- `422 BSAMPLE_WINDOW_CLOSED`
- `422 NO_BSAMPLE_FOR_THIS_BATCH`

---

### GROUP 7 — LISTINGS `/api/listings`

#### POST `/api/listings`
**Auth:** FARMER  
**Body:**
```json
{
  "batch_id": "uuid",
  "price_per_kg_paise": 18800,
  "min_order_kg": 10.0,
  "max_order_kg": 500.0,
  "listing_type": "OPEN",
  "available_until": "2026-10-31T23:59:59Z"
}
```
Batch must be `test_passed`. Sets `batches.status = 'listed'`. Appends `BatchListed` BIR event.  
**Success 201:** Created listing with price recommendation comparison (`recommended_low_paise`, `recommended_high_paise` from price_intelligence cache).  
**Errors:**
- `422 BATCH_NOT_READY` — batch not in `test_passed` status
- `409 BATCH_ALREADY_LISTED` — active listing exists for this batch

#### GET `/api/listings`
**Auth:** CONSUMER, BULK_BUYER, FARMER (own), ADMIN  
**Query:** `?crop_type=TURMERIC&city=Delhi&min_quality=85&page=1&limit=20&sort=demand_match`  
`sort=demand_match` ranks by demand forecast for the city. Returns demand forecast alongside each listing.  
**Success 200:** Paginated listings with batch summary, FPO trust score, demand signal.

#### GET `/api/listings/:listingId`
**Auth:** Any authenticated  
**Success 200:** Full listing with batch detail, quality tests, BIR summary, FPO profile.

#### PATCH `/api/listings/:listingId`
**Auth:** FARMER (own)  
**Body:** `{ "price_per_kg_paise": 19200, "available_until": "2026-11-30T23:59:59Z" }`  
Cannot change price if there are pending orders against this listing.  
**Success 200:** Updated listing.  
**Errors:** `422 PRICE_CHANGE_BLOCKED_PENDING_ORDERS`

#### PATCH `/api/listings/:listingId/status`
**Auth:** FARMER (own), ADMIN  
**Body:** `{ "status": "paused" }` — valid: `active → paused`, `paused → active`, `active → cancelled`  
Cannot cancel if pending orders exist.  
**Success 200:** Updated listing.

#### GET `/api/listings/recommended`
**Auth:** CONSUMER, BULK_BUYER  
**Query:** `?city=Delhi&role=CONSUMER` — role filters listing_type  
Returns top 5 listings ranked by: demand match for city + FPO trust score + quality score.  
**Success 200:** 5 listings with demand match explanation.

---

### GROUP 8 — ORDERS `/api/orders`

#### POST `/api/orders`
**Auth:** CONSUMER, BULK_BUYER  
**Body:**
```json
{
  "items": [
    { "listing_id": "uuid", "quantity_kg": 25.0 }
  ],
  "delivery_address": {
    "line1": "123 MG Road",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110001",
    "lat": 28.6139,
    "lng": 77.2090
  },
  "delivery_notes": "Call before delivery",
  "payment_reference": "UPI-TXN-9876543210"
}
```
Full atomic transaction (see DB_GUIDE Pattern — escrow hold + order create).  
**Success 201:** Created order with escrow confirmation.  
**Errors:**
- `409 INSUFFICIENT_STOCK` — remaining_quantity_kg < requested
- `409 MIN_ORDER_NOT_MET` — quantity < listing.min_order_kg
- `409 MAX_ORDER_EXCEEDED` — quantity > listing.max_order_kg
- `422 LISTING_NOT_ACTIVE`
- `422 LISTING_TYPE_MISMATCH` — CONSUMER ordering from BULK_ONLY listing

#### GET `/api/orders`
**Auth:** CONSUMER, BULK_BUYER (own), FARMER (orders on their batches), ADMIN (all)  
**Query:** `?status=delivered&page=1&limit=10`  
**Success 200:** Paginated orders with items, batch summary, delivery status.

#### GET `/api/orders/:orderId`
**Auth:** Order buyer, batch FPO, ADMIN  
**Success 200:** Full order with items, delivery route, escrow status, BIR events for all items.

#### PATCH `/api/orders/:orderId/cancel`
**Auth:** CONSUMER, BULK_BUYER (own, before dispatch)  
**Body:** `{ "reason": "Changed delivery address" }`  
Only when `status IN ('placed','confirmed')`. Triggers full refund from escrow.  
**Success 200:** Updated order with refund confirmation.  
**Errors:** `422 ORDER_CANNOT_BE_CANCELLED` — already dispatched

#### PATCH `/api/orders/:orderId/confirm`
**Auth:** FARMER (FPO confirming order on their batch)  
Transitions `placed → confirmed`. Auto-confirmed after 2h by cron if FPO doesn't act.  
**Success 200:** Confirmed order.

#### PATCH `/api/orders/:orderId/delivered`
**Auth:** LOGISTICS (driver assigned to this route), ADMIN  
Fires `DeliveredToConsumer` BIR event. Triggers escrow release (unless temp breach flagged or open dispute).  
**Success 200:** Delivered order with escrow release confirmation.  
**Errors:**
- `422 TEMPERATURE_BREACH_REVIEW` — batch flagged; admin must override
- `409 OPEN_DISPUTE_BLOCKS_DELIVERY`

#### GET `/api/orders/:orderId/track`
**Auth:** Order buyer, LOGISTICS  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "order_status": "dispatched",
    "driver_name": "Suresh Kumar",
    "vehicle_id": "MH-AB-1234",
    "current_stop": { "name": "Andheri Hub", "sequence": 2 },
    "next_stop": { "name": "Consumer Delivery", "estimated_arrival": "2026-09-07T14:30:00Z" },
    "temperature_status": "maintained",
    "last_temp_reading_c": 7.4
  }
}
```

#### POST `/api/orders/:orderId/allocation`
**Auth:** ADMIN (manual trigger), or system (cron after confirm)  
Runs allocation engine for this order. Updates order_items with allocated batch quantities.  
**Success 200:** Allocation result with sourced FPOs and quantities.  
**Errors:** `422 INSUFFICIENT_SUPPLY_FOR_ALLOCATION` — triggers shortage handling flow

---

### GROUP 9 — LOGISTICS `/api/logistics`

#### GET `/api/logistics/dashboard`
**Auth:** LOGISTICS  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "assigned_routes": 2,
    "completed_today": 1,
    "active_route": { "route_id": "uuid", "stops_remaining": 3, "next_stop": {...} },
    "pending_pickups": 1
  }
}
```

#### GET `/api/logistics/routes`
**Auth:** LOGISTICS (own), ADMIN (all)  
**Query:** `?status=in_progress&date=2026-09-07`  
**Success 200:** Assigned routes with stops.

#### GET `/api/logistics/routes/:routeId`
**Auth:** LOGISTICS (assigned), ADMIN  
**Success 200:** Full route with all stops, order details, map coordinates array.

#### PATCH `/api/logistics/routes/:routeId/start`
**Auth:** LOGISTICS (assigned driver)  
Sets `status = 'in_progress'`, `started_at = NOW()`.  
**Success 200:** Updated route.

#### PATCH `/api/logistics/routes/:routeId/stops/:stopId/complete`
**Auth:** LOGISTICS (assigned driver)  
**Body:** `{ "notes": "Delivered to security desk" }` (optional)  
Sets `actual_arrival_at`, `completed_at`. If stop_type = 'DELIVERY', triggers order delivery flow (calls POST `/api/orders/:orderId/delivered` internally).  
**Success 200:** Updated stop.

#### POST `/api/logistics/temperature-log`
**Auth:** LOGISTICS  
**Body:**
```json
{
  "batch_id": "uuid",
  "route_id": "uuid",
  "temperature_c": 7.4,
  "threshold_c": 8.0,
  "vehicle_id": "MH-AB-1234",
  "location_lat": 19.076,
  "location_lng": 72.877
}
```
If `temperature_c > threshold_c`: `breach_detected = true`; fires `TemperatureBreachDetected` BIR event; sends notification to ops; flags batch for review.  
**Success 201:** Temperature log record.

---

### GROUP 10 — DEMAND INTELLIGENCE `/api/demand`

#### GET `/api/demand/forecast`
**Auth:** FARMER, ADMIN, BULK_BUYER  
**Query:** `?crop_type=TURMERIC&city=Delhi&days=30`  
Returns from `demand_forecasts` cache first. If stale (> 6h), triggers async AI service refresh.  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "crop_type": "TURMERIC",
    "city": "Delhi",
    "forecast_date": "2026-10-07",
    "predicted_kg": 4832,
    "confidence_pct": 84,
    "range_low_kg": 4100,
    "range_high_kg": 5600,
    "demand_drivers": [
      { "factor": "historical_demand_trend", "contribution_pct": 42 },
      { "factor": "navratri_festival_14d", "contribution_pct": 28 },
      { "factor": "subscription_growth", "contribution_pct": 18 },
      { "factor": "price_trend_favorable", "contribution_pct": 12 }
    ],
    "stale": false,
    "generated_at": "2026-09-07T06:00:00Z"
  }
}
```
If AI service down: return last cached with `"stale": true`. Never 500.

#### GET `/api/demand/multi-city`
**Auth:** FARMER, ADMIN  
**Query:** `?crop_type=TURMERIC&cities=Delhi,Mumbai,Ahmedabad`  
Returns demand forecast for each city in one call. Used for price intelligence + routing decisions.  
**Success 200:** Array of forecast objects per city.

#### POST `/api/demand/refresh`
**Auth:** ADMIN  
Triggers immediate forecast refresh for specified crop+city via AI service.  
**Body:** `{ "crop_type": "TURMERIC", "city": "Delhi" }`  
**Success 200:** `{ "message": "Refresh queued." }`

---

### GROUP 11 — PRICE INTELLIGENCE `/api/price`

#### GET `/api/price/recommendation`
**Auth:** FARMER, ADMIN  
**Query:** `?crop_type=TURMERIC&quality_score=94&city=Delhi`  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "crop_type": "TURMERIC",
    "quality_score_band": "PREMIUM",
    "destination_city": "Delhi",
    "commodity_price_paise": 14000,
    "recommended_low_paise": 18200,
    "recommended_high_paise": 19700,
    "premium_pct": 33.5,
    "buyer_acceptance_prob": 89.0,
    "data_source": "eNAM_mock_feed",
    "generated_at": "2026-09-07T06:00:00Z"
  }
}
```

#### GET `/api/price/market-rates`
**Auth:** Any authenticated  
**Query:** `?crop_type=TURMERIC`  
Returns last 30 days of commodity prices from eNAM mock feed for the given crop.  
**Success 200:** Array of `{ date, price_paise, source }`.

#### GET `/api/price/premium-calculator`
**Auth:** FARMER  
**Query:** `?quality_score=94&crop_type=TURMERIC&quantity_kg=2500&destination_city=Delhi`  
Returns estimated total realization vs commodity baseline. Used in batch listing screen.  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "at_commodity_rate_paise": 35000000,
    "at_recommended_rate_paise": 47500000,
    "premium_paise": 12500000,
    "premium_pct": 35.7
  }
}
```

---

### GROUP 12 — SIMULATION `/api/simulation`

#### POST `/api/simulation/run`
**Auth:** ADMIN, FARMER  
**Body:**
```json
{
  "crop_type": "TURMERIC",
  "city": "Delhi",
  "demand_spike_pct": 25,
  "supply_disruption_pct": 15
}
```
Calls AI service `/simulate`. Returns decision engine response.  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "input": { "demand_spike_pct": 25, "supply_disruption_pct": 15 },
    "shortage_kg": 3200,
    "recommended_actions": [
      { "action": "SOURCE_ALTERNATE_FPO", "fpo_name": "Rajasthan Mustard Collective", "distance_km": 180, "available_kg": 2800 },
      { "action": "ADJUST_PRICE_CEILING", "adjustment_paise": 180, "new_ceiling_paise": 21800 },
      { "action": "REROUTE_VEHICLE", "vehicle_id": "MH-AB-1234", "new_stops": 2 }
    ],
    "farmer_realization_change_pct": 6.4,
    "logistics_cost_change_pct": -11.2,
    "run_duration_ms": 847
  }
}
```

#### GET `/api/simulation/history`
**Auth:** ADMIN  
**Query:** `?page=1&limit=20`  
Returns past simulation runs for the admin dashboard.  
**Success 200:** Paginated list of simulation_runs.

---

### GROUP 13 — QR `/api/qr`

#### GET `/api/qr/scan/:qrHash`
**Auth:** None (public)  
Returns the public BIR view. Same as `GET /api/batches/:batchId/bir` but keyed by `qr_hash`.  
Appends `QRScanned` BIR event (actor_id null for anonymous scans).  
**Success 200:** Full public BIR view.  
**Errors:** `404 QR_NOT_FOUND`, `410 BATCH_REJECTED` (with rejection reason)

#### POST `/api/qr/burn/:qrHash`
**Auth:** CONSUMER (own order for this batch), ADMIN  
Appends `QRBurned` BIR event. Sets `batches.qr_burned_at`.  
Idempotent: second burn attempt returns 409, not 500.  
**Body:** `{}` (empty)  
**Success 200:** `{ "message": "QR code successfully invalidated." }`  
**Errors:**
- `409 QR_ALREADY_BURNED` — unique constraint hit; return friendly message not 500
- `403 NOT_YOUR_BATCH` — consumer didn't order this batch

#### GET `/api/qr/generate/:batchId`
**Auth:** FARMER (own batch), ADMIN  
Returns PNG QR code image (base64 or stream) for printing on label.  
**Success 200:** `{ "qr_hash": "...", "qr_image_base64": "..." }`

---

### GROUP 14 — DISPUTES `/api/disputes`

#### POST `/api/disputes`
**Auth:** CONSUMER, BULK_BUYER  
**Body:**
```json
{
  "order_id": "uuid",
  "reason_category": "QUALITY_MISMATCH",
  "description": "Received Grade B turmeric instead of Grade A per certificate."
}
```
Only within 48h of delivery. Sets `orders.status = 'disputed'`.  
**Success 201:** Created dispute.  
**Errors:**
- `422 DISPUTE_WINDOW_CLOSED` — > 48h post-delivery
- `409 DISPUTE_ALREADY_EXISTS` — one open dispute per order

#### GET `/api/disputes`
**Auth:** CONSUMER (own), BULK_BUYER (own), ADMIN (all)  
**Query:** `?status=open&page=1&limit=10`  
**Success 200:** Paginated disputes.

#### GET `/api/disputes/:disputeId`
**Auth:** Dispute raiser, batch FPO, ADMIN  
**Success 200:** Full dispute with evidence, BIR events referenced.

#### POST `/api/disputes/:disputeId/evidence`
**Auth:** Dispute raiser or ADMIN  
**Body:** multipart: `evidence_type`, `description`, `file` (optional), `bir_event_id` (optional)  
**Success 201:** Evidence record.

#### PATCH `/api/disputes/:disputeId/resolve`
**Auth:** ADMIN  
**Body:**
```json
{
  "resolution": "Quality mismatch confirmed via BIR event log. Partial refund issued.",
  "refund_amount_paise": 25000,
  "outcome": "resolved"
}
```
Triggers partial or full escrow refund if `refund_amount_paise > 0`.  
Sets `disputes.status = 'resolved'`, `orders.status = 'delivered'` (or `refunded`).  
**Success 200:** Updated dispute.

---

### GROUP 15 — ADMIN `/api/admin`

#### GET `/api/admin/dashboard`
**Auth:** ADMIN  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "total_fpos": 3,
    "total_batches": 47,
    "active_listings": 12,
    "total_orders": 89,
    "escrow_held_paise": 8400000,
    "iei": {
      "avg_farmer_premium_pct": 33.5,
      "avg_logistics_saving_pct": 28.2,
      "avg_consumer_saving_pct": 15.1,
      "orders_settled_under_24h": 84
    },
    "demand_alerts": [
      { "crop_type": "TURMERIC", "city": "Delhi", "shortage_kg": 900 }
    ]
  }
}
```

#### GET `/api/admin/batches`
**Auth:** ADMIN  
**Query:** `?status=test_failed&fpo_id=uuid&page=1&limit=20`  
All batches, all FPOs. Full admin view.

#### GET `/api/admin/users`
**Auth:** ADMIN  
**Query:** `?role=FARMER&status=active&page=1&limit=20`

#### PATCH `/api/admin/users/:userId/status`
**Auth:** ADMIN  
**Body:** `{ "status": "suspended", "reason": "Fraudulent batch submission" }`  
Valid: `active → suspended`, `suspended → active`.  
Audit log mandatory.  
**Success 200:** Updated user.

#### GET `/api/admin/escrow`
**Auth:** ADMIN  
**Query:** `?status=held&page=1&limit=20`  
All escrow transactions with order and buyer details.

#### POST `/api/admin/escrow/:escrowId/release`
**Auth:** ADMIN  
Manual release (e.g., after temperature breach review clearance).  
**Body:** `{ "reason": "Temperature breach reviewed and cleared by ops team." }`  
Writes audit_log. Sets `release_triggered_by = 'MANUAL_ADMIN'`.  
**Success 200:** Released escrow.

#### GET `/api/admin/iei`
**Auth:** ADMIN  
**Query:** `?from=2026-01-01&to=2026-09-30&crop_type=TURMERIC`  
Returns full Intermediation Efficiency Index data.  
**Success 200:** Full IEI dataset for charting.

#### GET `/api/admin/audit-logs`
**Auth:** ADMIN  
**Query:** `?entity_type=batch&entity_id=uuid&page=1&limit=50`  
**Success 200:** Paginated audit trail.

#### POST `/api/admin/routes/optimize`
**Auth:** ADMIN  
**Body:**
```json
{
  "order_ids": ["uuid1", "uuid2", "uuid3"],
  "vehicle_type": "COLD_VAN",
  "depot_lat": 19.076,
  "depot_lng": 72.877
}
```
Calls AI service `/optimize-routes`. Creates `delivery_routes` and `route_stops` records.  
Returns optimized route with savings vs baseline.  
**Success 201:** Created delivery route.

#### PATCH `/api/admin/batches/:batchId/temperature-breach-clear`
**Auth:** ADMIN  
Clears temperature breach flag. Allows escrow release to proceed.  
Mandatory body: `{ "review_notes": "..." }` — cannot be empty.  
Appends audit_log record.  
**Success 200:** Cleared batch flag.

---

### GROUP 16 — DPI MOCK `/api/dpi`

#### GET `/api/dpi/agristack/farmer/:farmerId`
**Auth:** ADMIN, FARMER  
Returns mock AgriStack Farmer ID profile.  
Clearly labeled in response: `"data_source": "AgriStack_mock_sandbox"`.  
**Success 200:**
```json
{
  "success": true,
  "data": {
    "farmer_id": "AGS-2026-MH-00041",
    "name": "Ravi Patil",
    "state": "Maharashtra",
    "district": "Sangli",
    "crop_sown": [{ "crop": "TURMERIC", "area_acres": 2.4, "season": "Kharif 2026" }],
    "data_source": "AgriStack_mock_sandbox",
    "note": "Production integration requires authorized state API access and farmer consent."
  }
}
```

#### GET `/api/dpi/enam/prices`
**Auth:** Any authenticated  
**Query:** `?crop_type=TURMERIC&days=30`  
Returns data from `backend/mocks/enam-prices.json`.  
Labeled: `"data_source": "eNAM_mock_feed"`.  
**Success 200:** Array of price records.

#### GET `/api/dpi/ondc/listings`
**Auth:** ADMIN  
Returns all active BharatPure listings formatted as ONDC SNP catalog items.  
Labeled: `"data_source": "ONDC_sandbox_adapter"`, `"note": "Production deployment requires ONDC participant onboarding."`.  
**Success 200:** ONDC-format catalog.

---

### GROUP 17 — WEBHOOKS `/api/webhooks`

#### POST `/api/webhooks/whatsapp`
**Auth:** Twilio signature validation (X-Twilio-Signature header)  
**Body:** Twilio WhatsApp webhook payload (form-urlencoded)  
Validates Twilio signature using `TWILIO_AUTH_TOKEN`. Rejects if invalid (return 403 immediately).  
Processes message through WhatsApp bot state machine.  
**Success 200:** TwiML response (plain text).  
Never return 500 to Twilio — log internally and return a safe fallback message.

---

## RATE LIMITS (apply via express-rate-limit)

| Route group | Limit |
|---|---|
| POST `/api/auth/register` | 3 per hour per IP |
| POST `/api/auth/login` | 10 per 15 min per IP |
| POST `/api/auth/forgot-password` | 3 per hour per IP |
| POST `/api/auth/verify-otp` | 5 per 15 min per user |
| GET `/api/demand/*` | 60 per min per user |
| POST `/api/simulation/run` | 10 per hour per user |
| POST `/api/webhooks/whatsapp` | 100 per min (Twilio sends in bursts) |
| All other routes | 100 per min per user |

---

## ZOD VALIDATION — SHARED TYPES

Define in `backend/src/validators/{domain}.validator.js` AND mirror in `frontend/src/types/{domain}.types.ts`.

Key validation rules to enforce in Zod:
- Phone: `z.string().regex(/^[6-9]\d{9}$/)` — Indian mobile numbers only
- GSTIN: `z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)` — 15-char GSTIN format
- Pincode: `z.string().regex(/^[1-9][0-9]{5}$/)` — 6-digit Indian pincode
- Paise: `z.number().int().positive()` — never float
- Quantity: `z.number().positive().multipleOf(0.5)` — kg in 0.5 increments
- Date strings: `z.string().datetime()` for TIMESTAMPTZ, `z.string().date()` for DATE
- Latitude: `z.number().min(-90).max(90)`
- Longitude: `z.number().min(-180).max(180)`

---

*End of BHARATPURE-API.md — Batch 3 of 5*
*Next: BHARATPURE-UI.md — design system + all 47 screens in Stitch-parseable format*
