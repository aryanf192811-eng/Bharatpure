# BHARATPURE-UI.md — Design System & Screen Registry
> Stitch: read each SCREEN block sequentially and generate designs in order.
> Claude Code: read the design tokens section before writing any Tailwind class.
> Every screen has a type (mobile-pwa or web), role, route, layout, sections, data, and actions.

---

## DESIGN SYSTEM — TOKENS (concrete values, not adjectives)

### Color Palette

```css
/* Primary — Deep Forest Green (farmland, trust, growth) */
--color-primary-900: #0D2818;
--color-primary-800: #1B4332;   /* ← main brand color */
--color-primary-700: #2D6A4F;
--color-primary-600: #40916C;
--color-primary-500: #52B788;
--color-primary-400: #74C69D;
--color-primary-100: #D8F3DC;
--color-primary-50:  #F0FDF4;

/* Secondary — Harvest Gold (quality, premium, verified) */
--color-secondary-800: #92650A;
--color-secondary-600: #C8971A;  /* ← main gold */
--color-secondary-400: #E9B949;
--color-secondary-100: #FDF3D0;
--color-secondary-50:  #FFFBEB;

/* Accent — Terracotta (CTAs, energy, earth) */
--color-accent-700: #9A3412;
--color-accent-600: #C4522A;     /* ← main accent */
--color-accent-400: #E8795F;
--color-accent-100: #FFEDD5;

/* Background / Surface */
--color-bg:          #FDF8F0;    /* warm parchment — main background */
--color-surface:     #FFFFFF;    /* pure white — cards, modals */
--color-surface-alt: #F5F0E8;   /* off-white — alternate rows, sidebars */
--color-border:      #E2D9CC;   /* warm grey — card borders, dividers */
--color-border-focus:#1B4332;   /* primary green on focus */

/* Text */
--color-text-primary:   #1C1408;  /* deep ink */
--color-text-secondary: #5C4F38;  /* medium ink */
--color-text-muted:     #9B8B72;  /* labels, hints, placeholder */
--color-text-inverted:  #FFFFFF;  /* on dark backgrounds */

/* Semantic */
--color-success:      #2D6A4F;   /* verified, passed, delivered */
--color-success-bg:   #D1FAE5;
--color-warning:      #E8841A;   /* pending, review */
--color-warning-bg:   #FEF3C7;
--color-danger:       #C4522A;   /* rejected, failed, breach */
--color-danger-bg:    #FEE2E2;
--color-info:         #1D6FA4;   /* informational, neutral blue */
--color-info-bg:      #E0F2FE;
```

### Typography

```css
/* Font Families */
--font-display: 'Playfair Display', Georgia, serif;   /* headings, brand moments */
--font-body:    'Inter', -apple-system, sans-serif;   /* all UI text */
--font-mono:    'JetBrains Mono', 'Courier New', monospace; /* batch IDs, codes, numbers */

/* Scale (rem) */
--text-xs:   0.75rem;   /* 12px — badges, legal, fine print */
--text-sm:   0.875rem;  /* 14px — secondary labels, table rows */
--text-base: 1rem;      /* 16px — body text */
--text-lg:   1.125rem;  /* 18px — section headings, emphasized body */
--text-xl:   1.25rem;   /* 20px — card titles */
--text-2xl:  1.5rem;    /* 24px — page headings */
--text-3xl:  1.875rem;  /* 30px — dashboard hero numbers */
--text-4xl:  2.25rem;   /* 36px — landing display */

/* Weights */
--font-regular:   400;
--font-medium:    500;
--font-semibold:  600;
--font-bold:      700;

/* Line heights */
--leading-tight:  1.25;
--leading-snug:   1.375;
--leading-normal: 1.5;
--leading-relaxed:1.625;
```

### Spacing Scale

```
4px  — xs  (icon padding, chip gaps)
8px  — sm  (inline spacing, label gaps)
12px — md  (compact card padding)
16px — base(standard card padding, form gaps)
24px — lg  (section gaps, card margins)
32px — xl  (page section separation)
48px — 2xl (hero sections)
64px — 3xl (page-level breathing room)
```

### Border Radius

```
2px  — sharp (table borders, dividers)
4px  — sm    (input fields, small buttons)
8px  — base  (cards, panels)
12px — md    (modal corners, larger cards)
16px — lg    (bottom sheet, action sheets — mobile)
999px— full  (pills, badges, avatar circles)
```

### Shadows / Elevation

```css
--shadow-sm:  0 1px 2px rgba(28,20,8,.06);           /* resting card */
--shadow-md:  0 4px 12px rgba(28,20,8,.08);          /* elevated card, dropdown */
--shadow-lg:  0 8px 24px rgba(28,20,8,.12);          /* modal, side panel */
--shadow-xl:  0 16px 40px rgba(28,20,8,.16);         /* floating action */
--shadow-inner: inset 0 2px 4px rgba(28,20,8,.06);  /* input focus ring */
```

### Component Rules

- **shadcn/ui is the base layer.** Never edit files in `components/ui/`. Wrap in named components under `components/shared/`.
- **BIR event timeline** → custom component `<BIRTimeline />` — green dots connected by a vertical line, each dot shows event type + timestamp.
- **Quality score** → custom `<QualityBadge score={94} tier="NABL" />` — green pill for ≥90, amber for 70–89, red for <70.
- **Demand signal** → custom `<DemandSignal crop="TURMERIC" city="Delhi" delta={+18} confidence={84} />` — upward arrow in green when positive demand.
- **Batch status pill** → `<BatchStatusPill status="listed" />` — each status has its own color from the palette above.
- **IEI metric** → `<IEIMetric label="Farmer Premium" before="₹22/kg" after="₹188/kg" delta="+754%" />` — stacked before/after with green delta.
- **Farm-to-table step** → `<BIRStep icon="🌾" label="Harvested" date="05 Sep 2026" verified />` — used in QR scan BIR view.

### Tailwind Config Extensions

```js
// tailwind.config.js — extend these
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: { 50:'#F0FDF4', 100:'#D8F3DC', 400:'#74C69D', 500:'#52B788', 600:'#40916C', 700:'#2D6A4F', 800:'#1B4332', 900:'#0D2818' },
        gold:    { 50:'#FFFBEB', 100:'#FDF3D0', 400:'#E9B949', 600:'#C8971A', 800:'#92650A' },
        earth:   { 50:'#FDF8F0', 100:'#F5F0E8', 200:'#E2D9CC', 500:'#9B8B72', 700:'#5C4F38', 900:'#1C1408' },
        terracotta: { 100:'#FFEDD5', 400:'#E8795F', 600:'#C4522A', 700:'#9A3412' },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body:    ['Inter', '-apple-system', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Courier New', 'monospace'],
      },
    },
  },
};
```

---

## PWA MOBILE — SHELL STRUCTURE

All PWA screens (Farmer, Consumer, Logistics) use this shell:

```
┌─────────────────────────┐  375px wide
│  STATUS BAR (OS)        │
├─────────────────────────┤
│  TOP NAV BAR            │  56px — logo left, notifications icon right
│  [Back arrow] [Title]   │
├─────────────────────────┤
│                         │
│   CONTENT AREA          │  flex-1, scrollable
│   (screen-specific)     │
│                         │
├─────────────────────────┤
│  BOTTOM TAB NAV         │  64px — 4-5 tabs with icon + label
└─────────────────────────┘
```

Bottom nav tabs per role:
- **FARMER:** Home / Batches / Contracts / Earnings / Profile
- **CONSUMER:** Browse / Orders / Scan QR / Profile
- **LOGISTICS:** Dashboard / Routes / Temperature / Profile

---

## WEB SHELL STRUCTURE

All web screens (Bulk Buyer, Admin) use this shell:

```
┌──────────────────────────────────────────┐  1280px+ wide
│  TOP NAV: Logo | Nav links | User menu   │  64px
├────────────┬─────────────────────────────┤
│            │                             │
│  SIDEBAR   │   MAIN CONTENT AREA         │
│  240px     │   flex-1, scrollable        │
│  (links,   │                             │
│  collapsed │                             │
│  on tablet)│                             │
└────────────┴─────────────────────────────┘
```

---

## SCREEN REGISTRY — 47 SCREENS

Format per screen:
- **Type:** mobile-pwa or web
- **Role:** who sees this
- **Route:** React Router path
- **Layout:** page layout pattern
- **Palette context:** which colors dominate
- **Sections:** ordered visual sections from top to bottom
- **Data:** what API data populates this screen
- **Actions:** what the user can do
- **States:** empty, loading, error variants

---

### SCREEN 01 — Landing / Role Selector
**Type:** web + mobile (responsive, seen by everyone before auth)
**Role:** Unauthenticated
**Route:** `/`
**Layout:** Full-screen centered hero, no nav bar, no sidebar
**Palette:** primary-800 background with gold accents on white card

**Sections:**
1. **Hero background** — Full viewport, `bg-primary-800`. Subtle SVG pattern of wheat/leaf motifs at 5% opacity in primary-900.
2. **Center card** — White card, shadow-xl, border-radius-lg, max-w-md centered. Contains:
   - BharatPure wordmark (Playfair Display, 32px, primary-800 on white)
   - Tagline: "India's Farm-to-Market Trust Network" (Inter, 16px, text-secondary)
   - Divider line
   - Section heading: "I am a..." (text-muted, 14px)
   - **5 role cards** in a 2-column grid (2+2+1 centered): Farmer/FPO, Consumer, Bulk Buyer, Logistics, Government. Each card: icon (emoji 32px) + role label + one-line description. On tap/click → navigates to `/register?role=FARMER` etc.
3. **Bottom link** — "Already have an account? Sign in" (text-primary-700, 14px)

**Data:** Static — no API call.
**Actions:** Select role → `/register?role={ROLE}`. Click sign in → `/login`.
**States:** No loading state needed.

---

### SCREEN 02 — Register
**Type:** web + mobile (responsive)
**Role:** Unauthenticated
**Route:** `/register?role=FARMER`
**Layout:** Two-column on web (left: green hero panel, right: form). Single column on mobile.
**Palette:** primary-800 left panel, white right form area

**Sections (form panel):**
1. **Progress indicator** — Step pills: "Account → Verify OTP → Done" (only step 1 active now, gold underline)
2. **Heading** — "Create your account" (Playfair Display, 24px)
3. **Role badge** — Pill showing selected role ("🌾 Farmer / FPO", primary-100 bg, primary-800 text)
4. **Common fields:** Full Name (text), Phone (tel, 10-digit), Email (email, optional for FARMER), Password (password + strength indicator bar), Confirm Password.
5. **Role-specific fields block** (shown only for relevant role):
   - FARMER: FPO Name, Registration Number, State (select), District (text), Primary Crop (select), AgriStack Farmer ID (optional, with "What's this?" tooltip)
   - CONSUMER: Delivery Pincode
   - BULK_BUYER: Company Name, GSTIN, Business Type (select)
   - LOGISTICS: Vehicle Type (select: Dry Van / Cold Van), Vehicle Registration Number, Base City
   - ADMIN: Admin Registration Code (password field)
6. **Submit button** — "Create Account" (primary-800 bg, white text, full width, 48px height)
7. **Sign in link** — "Already registered? Sign in"

**Data:** Static form. POST `/api/auth/register` on submit.
**Actions:** Submit → OTP screen. Role chip → back to Landing.
**States:** Loading (button spinner + disabled). Validation errors inline below each field (danger color). Server error toast top-right.

---

### SCREEN 03 — Login
**Type:** web + mobile
**Role:** Unauthenticated
**Route:** `/login`
**Layout:** Same two-column as Register.
**Palette:** primary-800 left panel, white right form

**Sections:**
1. **Heading** — "Welcome back" (Playfair Display, 24px)
2. **Identifier field** — "Phone or Email" label, text input
3. **Password field** — with show/hide toggle icon
4. **Forgot password link** — right-aligned below password field (text-primary-700, 14px)
5. **Sign in button** — primary-800 bg, full width
6. **Register link** — "New to BharatPure? Create account"

**Data:** POST `/api/auth/login`.
**Actions:** Submit → dashboard (by role). Forgot password → `/forgot-password`. Register → `/register`.
**States:** Loading. Error: `INVALID_CREDENTIALS` → red inline error. `OTP_REQUIRED` → redirect to OTP screen with phone pre-filled. `ACCOUNT_SUSPENDED` → red banner with support contact.

---

### SCREEN 04 — OTP Verification
**Type:** web + mobile
**Role:** Unauthenticated
**Route:** `/verify-otp`
**Layout:** Centered card, single column, max-w-sm
**Palette:** white card on primary-50 background

**Sections:**
1. **Back button** — top-left, icon only
2. **Icon** — Large lock or phone emoji, 48px, centered
3. **Heading** — "Enter verification code" (Playfair Display, 24px)
4. **Subtext** — "We sent a 6-digit code to +91 98765 43210" (text-secondary, 14px)
5. **DEV MODE BANNER** — Yellow banner (warning-bg): "Dev mode: Your OTP is **423819**" — only shown when `devOtp` present in API response. Dismiss button.
6. **OTP Input** — 6 individual character boxes (auto-advance on input, 48px × 52px each, border primary on focus). Backspace goes to previous box.
7. **Verify button** — "Verify Code" primary-800, full width
8. **Resend link** — "Didn't receive it? Resend (59s)" — countdown timer, becomes link after countdown

**Data:** POST `/api/auth/verify-otp`.
**Actions:** Enter 6 digits → auto-submit. Resend → POST `/api/auth/forgot-password` re-triggered.
**States:** Loading on submit. Error: `OTP_INVALID` → shake animation + red border on all boxes + "Incorrect code. X attempts remaining". `OTP_EXPIRED` → "Code expired. Request a new one."

---

### SCREEN 05 — Forgot Password
**Type:** web + mobile
**Route:** `/forgot-password`
**Layout:** Centered card, max-w-sm

**Sections:**
1. **Back to login** link
2. **Heading** — "Reset your password"
3. **Subtext** — "Enter your registered phone number."
4. **Phone field**
5. **Send OTP button**
6. After OTP sent → transitions to an inline OTP step (same page, slide-in animation)

**Data:** POST `/api/auth/forgot-password` then `/api/auth/verify-reset-otp`.
**States:** Loading. Success → OTP step appears. Error: `USER_NOT_FOUND` → "No account found with this number."

---

### SCREEN 06 — Reset Password
**Type:** web + mobile
**Route:** `/reset-password`
**Layout:** Centered card, max-w-sm

**Sections:**
1. **Heading** — "Create new password"
2. **New password field** + strength indicator
3. **Confirm password field**
4. **Reset button**

**Data:** POST `/api/auth/reset-password` with `resetToken` from previous step.
**States:** Success → redirect to `/login` with success toast. Error: `SAME_AS_OLD_PASSWORD` → inline error.

---

### SCREEN 07 — Farmer Dashboard
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/dashboard`
**Layout:** Scrollable single-column feed
**Palette:** primary-50 background, white cards, gold for earnings highlights

**Sections (top to bottom):**
1. **Header greeting** — "Good morning, Ravi 🌾" (Playfair Display, 22px). Subtext: "Sangli Turmeric FPO"
2. **Trust score ribbon** — Horizontal pill strip: "Trust Score: 88.4 / 100" (gold bg, primary-800 text). Tap → Trust Score screen.
3. **Demand signal cards** — Horizontal scroll row of `<DemandSignal />` cards, one per active crop:
   - Card: crop icon + "TURMERIC" + city "Delhi" + "+18% demand" (green arrow) + "84% confidence" + "Predicted shortfall: 0.9t" (amber)
   - Tap → full Demand Intelligence screen
4. **Quick actions row** — 4 icon buttons: "New Batch" / "View Batches" / "Contracts" / "Earnings" (2×2 grid, primary-50 bg, primary-800 icons, rounded-lg)
5. **My Batches — Active** — Section title + "View all →". 3 most recent batch cards:
   - Batch card: batch_code (mono font) + crop + quantity + status pill + quality score badge. Tap → Batch Detail.
6. **Earnings summary card** — White card: "This Month" heading. Two metric rows: "Earned: ₹28,400" (primary-800) / "Pending: ₹4,500" (warning). Button "View Full Earnings".
7. **Recent notifications** — 2 most recent notifications with icon + title + time. "View all" link.

**Data:** GET `/api/farmers/dashboard`
**Actions:** Tap demand card → demand screen. Tap "New Batch" → Batch Create step 1. Tap batch card → Batch Detail.
**States:** Loading skeleton (shimmer cards). Empty (no batches): illustration + "Create your first batch" CTA.

---

### SCREEN 08 — Batch List (Farmer)
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/batches`
**Layout:** Scrollable list with sticky filter tabs
**Palette:** primary-50 background, white list items

**Sections:**
1. **Page title** — "My Batches" + "+ New Batch" button (top right, primary-800, small)
2. **Filter tabs** — Sticky horizontal scrollable pills: All / Draft / Pending Test / Listed / Sold / Delivered / Rejected. Active tab: primary-800 bg, white text.
3. **Batch list** — Vertical stack of batch cards:
   - Batch card (list item): batch_code (mono, 14px, primary-800) | crop icon + crop name | quantity: "2,500 kg" | quality badge | status pill | harvest date. Right chevron →
   - Swipe left reveals: "Delete" (danger, only for draft/failed batches)

**Data:** GET `/api/batches?status={filter}&page=1&limit=20`
**Actions:** Tap card → Batch Detail. Tap "+ New Batch" → Batch Create. Filter tab → refetch.
**States:** Loading shimmer. Empty per tab: "No {status} batches." Pagination: "Load more" button at bottom.

---

### SCREEN 09 — Batch Create: Step 1 — Crop Details
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/batches/new/step-1`
**Layout:** Scrollable form with sticky progress bar at top
**Palette:** white form on primary-50 bg

**Sections:**
1. **Progress bar** — 3-step: [1 Crop ●] — [2 Quality ○] — [3 Pricing ○]. Gold active dot, grey incomplete.
2. **Step heading** — "Tell us about your harvest" (Playfair Display, 22px)
3. **Form fields:**
   - Cluster (select, shows cluster name + district + crop type)
   - Contract (select — only active contracts for this FPO, optional)
   - Crop Type (pre-filled from cluster, read-only if contract selected)
   - Harvest Date (date picker — cannot be future date)
   - Total Quantity (number input, kg, 0.5 increments, suffix "kg")
   - Notes (textarea, optional, "e.g. late-monsoon harvest, slightly darker color")
4. **"Continue" button** — primary-800, full width, sticky at bottom of screen

**Data:** GET `/api/clusters` (for dropdown). GET `/api/contracts?status=active` (for dropdown).
**Actions:** Continue → validate → Step 2. Back → Batch List.
**States:** Validation inline. If no active contracts: show "No active contracts. Proceed without." message.

---

### SCREEN 10 — Batch Create: Step 2 — Quality Information
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/batches/new/step-2`
**Layout:** Scrollable form, same progress bar
**Palette:** white form, sage-green info banners

**Sections:**
1. **Progress bar** — Step 2 active.
2. **Step heading** — "Quality assessment"
3. **Info banner** (success-bg, green border-left) — "Your batch will be tested by our team. Fill in what you know now; our field agent will verify on pickup."
4. **Form fields:**
   - Estimated Purity (slider, 0–100, with label "Your estimate") — optional
   - Last season purity score (text, read-only, pulled from farmer_profile.crop_history)
   - Storage Method (select: Jute bag / Polypropylene bag / Cold storage / Field stacked)
   - Any treatment applied? (radio: Yes / No). If Yes → text field "Describe treatment"
   - Pesticide use in last season (radio: None / Standard / Organic certified)
5. **Test tier info card** — expandable card explaining TIER1 vs TIER2 testing. "What gets tested?" link.
6. **"Continue" button** + "Back" link

**Data:** GET `/api/farmers/profile` (for last season data).
**Actions:** Continue → Step 3. Back → Step 1 (data persisted in local state).
**States:** All fields optional — can proceed without filling any.

---

### SCREEN 11 — Batch Create: Step 3 — Pricing & Listing
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/batches/new/step-3`
**Layout:** Scrollable form with price comparison card prominent
**Palette:** white form, gold for price recommendation panel

**Sections:**
1. **Progress bar** — Step 3 active.
2. **Step heading** — "Set your price"
3. **Price intelligence card** (gold-100 bg, gold-600 border) — Shows:
   - "BharatPure Recommended: ₹182 – ₹197 per kg"
   - "Commodity rate (eNAM): ₹140/kg"
   - "Your premium: +33%" (green)
   - Small disclaimer: "Based on quality estimate and Delhi demand"
4. **Price input** — "Your asking price" (number, paise stored, rupee displayed). Underlines in gold. Live premium calculator shows "vs commodity: +X%" as user types.
5. **Listing settings:**
   - Listing Type (radio: Open / Bulk Only / Consumer Only)
   - Minimum order (number, kg)
   - Maximum order (number, kg, optional)
   - Available until (date picker, optional)
6. **Earnings estimate card** — "Estimated realization at this price: ₹4,70,000" (for full batch). Shows with gold background.
7. **Submit button** — "Create Batch & List" (primary-800). On tap: POST `/api/batches` then POST `/api/listings`.
8. **"Save as draft"** link — POST `/api/batches` only, no listing.

**Data:** GET `/api/price/recommendation?crop_type=TURMERIC&quality_score=94&city=Delhi`
**Actions:** Submit → success animation → Batch Detail screen for new batch.
**States:** Loading price recommendation. Error on submit → toast.

---

### SCREEN 12 — Batch Detail (Farmer view)
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/batches/:batchId`
**Layout:** Scrollable detail page, hero batch status at top
**Palette:** status-colored hero (green for listed, amber for pending, red for rejected)

**Sections:**
1. **Status hero card** — Full-width card with status-colored background (e.g., success-bg for listed). Contains: batch_code (mono, large), crop name + emoji, status pill (large), quality score badge.
2. **Key metrics row** — 3 metric boxes: Quantity / Quality Score / Price/kg (if listed)
3. **BIR Timeline** — `<BIRTimeline />` component. Append-only event list, most recent at top. Each event: colored dot (primary=green, warning=amber, danger=red) + event type label + timestamp + actor name.
4. **Quality test results** (if exists) — Expandable card: test tier badge + result + purity score + test parameters (curcumin%, lead ppm etc. in table) + "Download Certificate" button (if cert available)
5. **Listing info** (if listed) — Card: price/kg + listing type + min/max order + views count. "Edit Listing" and "Pause Listing" buttons.
6. **Orders on this batch** (if any) — Compact order list with buyer name + quantity + status.
7. **B-Sample section** (only if TIER1 failed) — Card explaining B-sample protocol. "Request B-Sample Review" button. Window closes in: countdown timer.

**Actions:** "Submit for Testing" CTA (if draft). "Download Certificate". "Edit Listing". "Request B-Sample".
**States:** For `test_failed` status: red hero, rejection reason displayed prominently.

---

### SCREEN 13 — Quality Test Result (Farmer notification)
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/batches/:batchId/test-result`
**Layout:** Single-focus screen, result-first
**Palette:** success-bg for PASS, danger-bg for FAIL

**Sections:**
1. **Result hero** — Full-width banner: ✅ "Batch PASSED" (success-bg) or ❌ "Batch REJECTED" (danger-bg). Batch code prominently.
2. **Purity score gauge** — Semi-circular gauge, 0–100, needle at score. Colored zones: red 0–69, amber 70–89, green 90–100.
3. **Test parameters table** — Two-column: parameter name | measured value | (within safe range indicator).
4. **Certificate download button** (on PASS) — "Download NABL Certificate PDF"
5. **Next steps card** (on PASS) — "Your batch is now approved. You can list it on the marketplace." → "List Now" CTA.
6. **Rejection reason** (on FAIL) — Red bordered card: reason + guidance. B-sample request link.

**Data:** GET `/api/quality/batches/:batchId/tests`
**Actions:** "List Now" → Batch Create Step 3 pre-filled. "Download Certificate" → streams PDF.

---

### SCREEN 14 — Certificate Upload
**Type:** mobile-pwa + web
**Role:** FARMER, ADMIN
**Route:** `/farmer/batches/:batchId/upload-certificate`
**Layout:** Centered upload form

**Sections:**
1. **Heading** — "Upload NABL Certificate"
2. **Batch info** — Read-only: batch_code + crop + test date.
3. **File upload area** — Dashed border, `border-primary-400`. Drag-drop on web, file picker on mobile. Shows file name + size after selection. Max 5MB, PDF only. Error if wrong type/size.
4. **Certificate fields:** Cert Number (text), Lab Name (text), Issued Date (date), Expires Date (date, optional).
5. **Upload button** — "Submit Certificate" primary-800, full width.
6. **Progress bar** — Shown during upload (multipart form).

**Data:** POST `/api/quality/certificates` (multipart)
**States:** Upload progress bar. Success: certificate linked, BIR event shown. Error: MIME/size error inline.

---

### SCREEN 15 — Earnings Dashboard
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/earnings`
**Layout:** Stats overview + scrollable transaction history
**Palette:** gold accents for revenue numbers, primary for totals

**Sections:**
1. **Date range selector** — Pill tabs: This Month / Last 3 Months / This Year / Custom
2. **Summary cards row** (2×2 grid):
   - Total Earned: "₹2,84,000" (Playfair Display, large, primary-800)
   - Pending: "₹45,000" (warning color)
   - Total Batches: "14"
   - Quality Premium: "+₹84,000 vs commodity" (gold, with ↑ arrow)
3. **Earnings chart** — Recharts BarChart, monthly bars, primary-600 color, 200px height. X-axis: months. Y-axis: ₹ in thousands.
4. **Per-batch breakdown** — List of batches with: batch_code + crop + quantity sold + price/kg + total + status badge. Each row tappable → Batch Detail.

**Data:** GET `/api/farmers/earnings?from=...&to=...`
**States:** Loading shimmer on charts. Empty: "No earnings recorded for this period."

---

### SCREEN 16 — Procurement Contracts List
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/contracts`
**Layout:** Filter tabs + card list

**Sections:**
1. **Page title** + "+ New Contract" (small, top-right)
2. **Status tabs** — All / Active / Fulfilled / Cancelled
3. **Contract cards:**
   - Header: Crop emoji + crop name + cluster name
   - Row 1: Quantity: "2,500 kg" | Price Floor: "₹140/kg"
   - Row 2: Sowing: "15 Oct 2026" → Harvest: "20 Jan 2027"
   - Row 3: Status pill + Advance: "₹35,000 disbursed"
   - Tap → Contract Detail

**Data:** GET `/api/contracts`
**States:** Empty: "No contracts yet. The BharatPure team will contact you about the next procurement cycle."

---

### SCREEN 17 — Contract Detail
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/contracts/:contractId`
**Layout:** Detail card with sections

**Sections:**
1. **Status hero** — status pill + crop name + cluster
2. **Contract terms table** — Quantity / Price Floor / Price Ceiling / Sowing Date / Harvest Date / Advance Disbursed
3. **Linked batches** — List of batches created under this contract with status
4. **Timeline** — Contract creation → advance disbursed → expected harvest marker

---

### SCREEN 18 — FPO Trust Score
**Type:** mobile-pwa
**Role:** FARMER
**Route:** `/farmer/trust-score`
**Layout:** Score breakdown with metric bars
**Palette:** gold header, metric bars in primary-600

**Sections:**
1. **Score hero** — Large circular score display: "88.4" (Playfair Display, 48px) / 100. Ring chart around it with primary-600 fill. Label "Your Trust Score".
2. **Score breakdown** — 5 horizontal metric bars with labels + values:
   - Fulfillment Rate: 94.2% | ████████░░ (primary-600)
   - Quality Consistency: 91.0% | ████████░░
   - On-time Delivery: 86.5% | ████████░░
   - Dispute Rate: 2.1% | (inverted — lower is better, shown in success green)
   - Buyer Rating: 4.6/5 | ⭐⭐⭐⭐⭐
3. **How it's computed** — Expandable accordion with formula explanation.
4. **Last computed** — Timestamp. "Updated nightly."

**Data:** GET `/api/farmers/trust-score`

---

### SCREEN 19 — Consumer Browse / Dashboard
**Type:** mobile-pwa
**Role:** CONSUMER
**Route:** `/consumer/browse`
**Layout:** Discovery feed — search bar + chips + cards
**Palette:** primary-50 bg, white cards, gold quality badges

**Sections:**
1. **Search bar** — "Search by crop, FPO, or location" with 🔍. Below: horizontal chip row: All / Spices / Oils / Honey / Grains / Dairy
2. **Demand-matched banner** (only if user has order history / location) — "🔥 High demand in Delhi: Turmeric +18%" (warning-bg card, tappable to pre-filter turmeric)
3. **Recommended for you** — Section title. 2 listing cards (see card spec below).
4. **All verified listings** — Vertical list of listing cards. Infinite scroll or "Load more".

**Listing Card spec (used everywhere for consumers):**
- Image placeholder: crop-color background with crop emoji (64×64)
- FPO name + district + state (14px, text-muted)
- Crop name (18px, bold, primary-800)
- Quality badge: "94/100 NABL Certified" (green pill)
- Price: "₹188/kg" (24px, Playfair Display, primary-800)
- Min order: "Min 0.5 kg"
- "Verified" checkmark in corner (primary-600)
- Tap → Product Detail

**Data:** GET `/api/listings?city=Delhi&page=1&limit=10&sort=demand_match`
**Actions:** Search → filter listings. Tap chip → filter. Tap card → Product Detail.

---

### SCREEN 20 — Product Detail (Consumer)
**Type:** mobile-pwa
**Role:** CONSUMER
**Route:** `/consumer/listings/:listingId`
**Layout:** Top hero + scrollable body + sticky bottom CTA
**Palette:** white bg, primary for key data, gold for quality

**Sections:**
1. **Product hero** — Crop-color gradient header (120px) with crop emoji (64px) centered. Batch code (mono, small, text-inverted) top-left.
2. **Product info** — FPO name + district. Crop type (Playfair Display, 24px). Harvest date.
3. **Quality card** (gold-100 bg, gold border-left) — "Verified Quality" heading. Quality score (large). Test tier badge. Top 3 test parameters in small pills.
4. **Price section** — "₹188 / kg" (32px, Playfair Display). Quantity selector (−/+, 0.5 increments, min/max enforced). Total: "₹940 for 5 kg" (live-computed).
5. **Provenance strip** — 5 horizontal steps: 🌾 Farm → ⚙️ Process → 🧪 Test → 📦 Pack → 🚚 Deliver. Each step has primary-600 dot. Tap → QR scan result BIR view.
6. **FPO trust score** — "FPO Trust Score: 88.4 / 100" with mini score bar.
7. **Demand signal** (if high) — "⬆ High demand in your area this week" (warning-bg small card)
8. **Add to Cart button** — Fixed bottom: "Add to Cart" (primary-800, full width, 52px, rounded-full)

**Data:** GET `/api/listings/:listingId`
**Actions:** Adjust quantity. Add to cart → cart badge updates. "View Full Trace" → QR Scan Result screen.

---

### SCREEN 21 — QR Scanner
**Type:** mobile-pwa
**Role:** CONSUMER (primary), any authenticated
**Route:** `/consumer/scan`
**Layout:** Full-screen camera feed with overlay
**Palette:** Dark overlay, white UI elements on top of camera feed

**Sections:**
1. **Camera feed** — Full viewport. Uses `react-qr-reader`.
2. **Scanning overlay** — Centered square scanning frame (white corners, 240×240px). Pulsing animation.
3. **Instruction text** — "Point at the QR code on your BharatPure package" (white, below frame)
4. **Torch toggle** — Flashlight icon bottom-right.
5. **Manual entry link** — "Enter batch code manually" below instruction text.

**Data:** On scan success: GET `/api/qr/scan/:qrHash`
**Actions:** Successful scan → navigate to QR Scan Result screen with data. Manual entry → text input modal.
**States:** Camera permission denied: instructions to enable + settings link. No QR detected: "Align the QR code within the frame."

---

### SCREEN 22 — QR Scan Result / BIR View
**Type:** mobile-pwa
**Role:** CONSUMER, public
**Route:** `/scan/:qrHash`
**Layout:** Scrollable provenance story — top-down narrative
**Palette:** white bg, primary-800 for verified elements, success-green for each passed checkpoint

**Sections:**
1. **Verified badge hero** — Full-width primary-800 band. "🟢 BATCH VERIFIED" (white, bold). Batch code (mono). QR not burned indicator or "QR Burned ✓".
2. **Farmer story card** — White card: farmer/FPO name. Farm location with 📍 pin on mini Leaflet map (GPS coordinates). Harvest date.
3. **Quality verified card** (success-bg) — Purity score gauge. Test tier badge. "NABL Certificate" → PDF download. Parameters: curcumin%, lead, pesticides etc.
4. **Journey timeline** — `<BIRTimeline />` — full event history from BatchCreated to DeliveredToConsumer (or current latest). Each event: icon + label + date.
5. **Cold chain log** (if cold product) — Temperature chart (Recharts LineChart, 150px). Max temp during transit. "✅ Cold chain maintained throughout" or "⚠ Breach detected" (with details).
6. **Natural variability note** (amber-bg card) — "This batch may look slightly different from previous batches. This is normal for single-origin produce." Batch-specific note from farmer.
7. **"Burn QR on Opening" section** — Only shown if not yet burned. Explanation card: "When you open the package, burn the QR to prevent reuse by others." "I've opened the package → Burn QR" button (danger-outlined, requires auth).

**Data:** GET `/api/qr/scan/:qrHash` (public). POST `/api/qr/burn/:qrHash` (requires auth).
**Actions:** Download cert. Burn QR (requires login if not authenticated). Share BIR link.

---

### SCREEN 23 — Cart
**Type:** mobile-pwa
**Role:** CONSUMER
**Route:** `/consumer/cart`
**Layout:** List + summary card

**Sections:**
1. **Items list** — Each item: crop emoji + FPO name + quantity (editable) + price. Swipe left → remove.
2. **Delivery address card** — Current address or "Add delivery address" CTA.
3. **Order summary card** — Subtotal / Delivery (free / calculated) / Total in paise (displayed as ₹).
4. **Proceed to Checkout button** — primary-800, full width.

**States:** Empty cart: illustration + "Browse verified produce" CTA.

---

### SCREEN 24 — Order Confirmation
**Type:** mobile-pwa
**Role:** CONSUMER
**Route:** `/consumer/orders/:orderId/confirmation`
**Layout:** Single-focus success screen

**Sections:**
1. **Success animation** — Checkmark lottie or CSS animation (primary-600 circle → white check).
2. **Order placed heading** — Playfair Display, 24px.
3. **Order details** — Order ID (mono) + items summary + total.
4. **Escrow note** — Info card: "Your payment is held securely until delivery. Released only when you receive your order."
5. **Estimated delivery** — Date + time window.
6. **Track Order button** + "Continue Shopping" link.

---

### SCREEN 25 — Order Tracking
**Type:** mobile-pwa
**Role:** CONSUMER
**Route:** `/consumer/orders/:orderId/track`
**Layout:** Status-first with map
**Palette:** Status-colored top band

**Sections:**
1. **Status banner** — Order status pill (large) + status description ("Your order is on the way").
2. **Mini route map** — Leaflet map showing current driver position (if dispatched) and delivery pin. 200px height.
3. **Progress steps** — Horizontal: Placed ✓ → Confirmed ✓ → Dispatched ✓ → Delivered ○. Active step in primary-800.
4. **Driver info card** (if dispatched) — Driver name + vehicle + "Cold chain: ✅ Maintained" + last temp reading.
5. **Items summary** — Collapsed list of ordered items.
6. **Raise Dispute** link — Only shown within 48h of delivery.

**Data:** GET `/api/orders/:orderId/track`

---

### SCREEN 26 — Order History (Consumer)
**Type:** mobile-pwa
**Role:** CONSUMER
**Route:** `/consumer/orders`
**Layout:** Filter tabs + order card list

**Sections:**
1. **Filter tabs** — All / Active / Delivered / Cancelled
2. **Order cards** — Date + order ID + items summary + total + status pill. Tap → Order Tracking or Confirmation.

---

### SCREEN 27 — Subscription Overview
**Type:** mobile-pwa
**Role:** CONSUMER
**Route:** `/consumer/subscriptions`
**Layout:** Subscription card + upcoming deliveries

**Sections:**
1. **Active subscriptions** — One card per active subscription: crop + frequency + next delivery date + auto-renew toggle.
2. **Upcoming deliveries** — Next 3 scheduled deliveries calendar view.
3. **"Add Subscription" button** → Browse with subscription filter.

**Note:** Subscription is a repeat-order pattern on top of existing order flow. No separate subscription table needed — use a `subscription_metadata` JSONB field on orders for Phase 5.

---

### SCREEN 28 — Bulk Buyer Dashboard
**Type:** web
**Role:** BULK_BUYER
**Route:** `/buyer/dashboard`
**Layout:** Two-column web layout — sidebar + main content

**Sections (main area):**
1. **Welcome strip** — "Fresh Provisions Pvt Ltd | Reliability Score: 89/100"
2. **Quick stats row** — 4 metric cards: Open Orders / Total Spent / Batches Sourced / Active Listings Available
3. **Demand-matched batches** — "Available now for your recent searches" — 3 listing cards in horizontal scroll
4. **Pending orders table** — Order ID / Items / Quantity / Total / Status / Action column
5. **Reliability score breakdown** — Compact version (full version → own screen)

**Data:** GET `/api/listings/recommended?city=Delhi&role=BULK_BUYER` + GET `/api/orders?status=confirmed`

---

### SCREEN 29 — Verified Batch Catalog (Bulk Buyer)
**Type:** web
**Role:** BULK_BUYER
**Route:** `/buyer/catalog`
**Layout:** Left filters panel + right grid of cards

**Sections:**
1. **Filters panel** (left, 260px) — Crop type (checkboxes) / Quality band (PREMIUM / STANDARD / ECONOMY) / Min quantity / State / FPO trust score min / "Only NABL Certified" toggle
2. **Results grid** (right) — 3-column card grid. Cards show: crop emoji + FPO name + quantity available + quality score + NABL cert badge + price/kg + "View & Order" button.
3. **Sort bar** — "Sort by: Demand match | Quality | Price | FPO Trust"
4. **Demand context strip** — "📊 Delhi demand: Turmeric +18% this month" (top, collapsible)

**Data:** GET `/api/listings?listing_type=BULK_ONLY&...`

---

### SCREEN 30 — Batch Detail (Bulk Buyer view)
**Type:** web
**Role:** BULK_BUYER
**Route:** `/buyer/listings/:listingId`
**Layout:** Two-column: left (provenance) | right (order form)

**Left panel — provenance:**
- Full BIR timeline
- Quality certificates (embedded PDF viewer or download)
- FPO trust score detail
- Demand forecast for this crop + city

**Right panel — order form:**
- Available quantity + your order quantity (number input with slider)
- Price/kg + total calculation (live, paise → rupees)
- Delivery address (saved addresses or add new)
- Estimated delivery date
- "Place Order" button (primary-800)
- "Add to Watchlist" (secondary)

**Data:** GET `/api/listings/:listingId` + GET `/api/price/premium-calculator`

---

### SCREEN 31 — Bulk Order Form
**Type:** web
**Role:** BULK_BUYER
**Route:** `/buyer/orders/new`
**Layout:** Multi-item order form with line-item table

**Sections:**
1. **Line items table** — Each row: Listing / FPO / Crop / Quantity (editable) / Price/kg / Subtotal / Remove
2. **Add more items** — "+ Add another batch" → opens catalog modal
3. **Delivery section** — Company name (pre-filled) + GST (pre-filled) + delivery address
4. **Order summary** — Subtotal / GST / Total. Breakdown per batch.
5. **Payment note** — "Payment held in secure escrow until delivery confirmed."
6. **Place Bulk Order** button

---

### SCREEN 32 — Order History (Bulk Buyer)
**Type:** web
**Role:** BULK_BUYER
**Route:** `/buyer/orders`
**Layout:** Sortable/filterable table

**Columns:** Order Date / Order ID / Batches / Quantity (kg) / Total (₹) / Status / Actions (View / Download Invoice / Dispute)

**Data:** GET `/api/orders?buyer_role=BULK_BUYER`

---

### SCREEN 33 — Driver Dashboard
**Type:** mobile-pwa
**Role:** LOGISTICS
**Route:** `/logistics/dashboard`
**Layout:** Single column, action-first
**Palette:** primary-50 bg, white cards, warning for urgent items

**Sections:**
1. **Status card** — Driver name + vehicle type badge + today's date
2. **Active route card** (if on a route) — Route name + "3 stops remaining" + next stop address + "Continue Route" CTA (primary-800, large)
3. **Today's routes** — List of assigned routes with status pills
4. **Quick action: Log Temperature** — Large button (warning-bg, thermometer icon) — for cold chain logging between stops

**Data:** GET `/api/logistics/dashboard`

---

### SCREEN 34 — Route Map View
**Type:** mobile-pwa
**Role:** LOGISTICS
**Route:** `/logistics/routes/:routeId`
**Layout:** Full-height map + bottom sheet

**Sections:**
1. **Leaflet map** — Full viewport. Shows all stops as numbered pins. Route line connecting them (polyline). Driver's current location as blue dot (geolocation API).
2. **Bottom sheet** (slides up to 40% height) — Draggable. Shows:
   - Route summary: total distance + estimated time + vehicle type
   - Stop list: numbered, with status (pending/completed). Current stop highlighted.
   - "Complete Stop" button (for current stop)
3. **Expanded stop view** (tap a stop) — Stop address + order items to deliver/pickup + "Mark Complete" CTA.

**Data:** GET `/api/logistics/routes/:routeId`
**Actions:** "Start Route" → PATCH `/api/logistics/routes/:routeId/start`. "Complete Stop" → PATCH `.../stops/:stopId/complete`.

---

### SCREEN 35 — Stop Detail / Pickup Confirmation
**Type:** mobile-pwa
**Role:** LOGISTICS
**Route:** `/logistics/routes/:routeId/stops/:stopId`
**Layout:** Single-focus confirmation screen

**Sections:**
1. **Stop type badge** — "PICKUP" (primary) or "DELIVERY" (success) or "HUB" (info)
2. **Location card** — Address + GPS coordinates + "Open in Maps" link (opens Google Maps deep link)
3. **Items at this stop** — For pickup: batch_code + crop + weight to collect. For delivery: order ID + buyer name + items.
4. **Confirmation checklist** (if DELIVERY) — "Items sealed and intact ✓" / "Correct recipient ✓" (checkboxes)
5. **Complete Stop button** — primary-800, full width

---

### SCREEN 36 — Temperature Log Entry
**Type:** mobile-pwa
**Role:** LOGISTICS
**Route:** `/logistics/temperature-log`
**Layout:** Single-purpose data entry screen

**Sections:**
1. **Heading** — "Log Temperature Reading"
2. **Batch selector** — dropdown of batches currently in vehicle (from active route)
3. **Temperature input** — Large number input (decimal), suffix "°C". Real-time color: green ≤ threshold, red > threshold.
4. **Threshold indicator** — "Safe below: 8.0°C for this batch" (from batch crop type)
5. **Location** — Auto-filled via geolocation. "Update" button if wrong.
6. **"Log Reading" button** — POST `/api/logistics/temperature-log`
7. **Breach warning** (shown if temp > threshold after logging) — Full-width red alert: "⚠ Temperature breach detected and logged. Ops team notified."

---

### SCREEN 37 — Delivery Confirmation (Logistics)
**Type:** mobile-pwa
**Role:** LOGISTICS
**Route:** `/logistics/deliver/:orderId`
**Layout:** Confirmation form

**Sections:**
1. **Order summary** — Order ID + buyer name + items
2. **Delivery checklist** — Checkboxes: "All items delivered" / "Recipient confirmed" / "Package seal intact"
3. **Notes field** — Optional: "Delivered to security desk"
4. **Confirm Delivery button** — PATCH `/api/orders/:orderId/delivered`
5. **Cold chain summary** — "Temperature maintained throughout: Max 7.6°C ✅"

---

### SCREEN 38 — Delivery Confirmation (Consumer view)
Covered by Screens 25 (Tracking) and 24 (Confirmation) above.

---

### SCREEN 38 — Admin Dashboard
**Type:** web
**Role:** ADMIN
**Route:** `/admin/dashboard`
**Layout:** Full web shell with sidebar. Dashboard grid.
**Palette:** primary-50 bg, white metric cards, gold for IEI highlights

**Sections:**
1. **Stats row** (6 metric cards) — Total FPOs / Active Batches / Total Orders / Escrow Held / Open Disputes / Demand Alerts. Each card: icon + value (large, Playfair Display) + trend indicator.
2. **IEI Panel** (full-width, gold-100 bg, gold border) — The Intermediation Efficiency Index:
   | Metric | Traditional | BharatPure | Delta |
   |---|---|---|---|
   | Farmer realization | ₹22/kg | ₹188/kg | **+754% ↑** |
   | Consumer price | ₹48/kg | ₹41/kg | **-15% ↓** |
   | Logistics distance | 286 km | 211 km | **-26% ↓** |
   | Settlement time | 4-7 days | <24h | **-80% ↓** |
   | Food loss | 11% | 6% | **-45% ↓** |
   Small disclaimer below: "Based on modelled estimates from prototype data."
3. **Demand alerts** — Amber bordered cards per crop+city showing shortage predictions.
4. **Recent activity feed** — Latest audit log entries.

**Data:** GET `/api/admin/dashboard`

---

### SCREEN 39 — Demand Intelligence Dashboard
**Type:** web
**Role:** ADMIN, FARMER (read-only version)
**Route:** `/admin/demand`
**Layout:** Controls + charts

**Sections:**
1. **Controls bar** — Crop type selector + City selector + Date range + "Refresh" button
2. **Main forecast chart** — Recharts LineChart (400px height). Lines: predicted demand + confidence band (shaded area between range_low and range_high) + historical actual (if available). X-axis: dates. Y-axis: kg.
3. **Demand drivers panel** — Horizontal stacked bar chart showing contribution of each driver (festival / trend / subscriptions / price). Per city.
4. **Multi-city comparison** (if multiple cities selected) — Small charts in 3-column grid.
5. **Shortfall alerts table** — Crop / City / Predicted shortfall / Recommended procurement / Status.

**Data:** GET `/api/demand/forecast` + GET `/api/demand/multi-city`

---

### SCREEN 40 — Price Intelligence Dashboard
**Type:** web
**Role:** ADMIN
**Route:** `/admin/price`

**Sections:**
1. **Market rate chart** — Recharts LineChart: eNAM commodity price over 30 days (grey line) vs BharatPure average realized price (primary-600 line). Shows premium gap clearly.
2. **Price recommendation table** — Crop / Quality Band / City / Commodity Rate / Recommended Range / Premium % / Buyer Acceptance Prob
3. **Premium calculator widget** — Input: crop, quality score, quantity, city → output: commodity vs BharatPure realization comparison.

**Data:** GET `/api/price/market-rates` + GET `/api/price/recommendation`

---

### SCREEN 41 — Route Optimization Control Panel
**Type:** web
**Role:** ADMIN
**Route:** `/admin/routes`

**Sections:**
1. **Pending deliveries table** — Select orders to include in optimization run. Checkboxes.
2. **Optimization settings** — Vehicle type selector / Depot location (map pin) / Time window constraints.
3. **Run Optimization button** — POST `/api/admin/routes/optimize`. Shows loading state (OR-Tools solving).
4. **Results panel** (after optimization) — Map showing routes for each vehicle. Before/after metrics card:
   - Vehicles: 3 → 2
   - Distance: 286 km → 211 km (−26%)
   - Cost: ₹8,940 → ₹6,420 (−28%)
5. **"Assign to Drivers" button** — Creates route records and assigns to available drivers.

**Data:** POST `/api/admin/routes/optimize`

---

### SCREEN 42 — What-if Simulator
**Type:** web
**Role:** ADMIN
**Route:** `/admin/simulate`
**Layout:** Two-panel: controls left, live results right
**Palette:** white left panel, primary-50 right results area. Results animate in.

**Sections (left — controls):**
1. **Heading** — "Scenario Simulator" (Playfair Display, 24px). Subtext: "Adjust parameters to see how the Decision Engine responds."
2. **Crop + city selectors**
3. **Slider 1** — "Demand spike" → 0% to +50%. Thumb: primary-800. Label updates live: "Demand: +25%"
4. **Slider 2** — "Supply disruption" → 0% to -40%. Thumb: danger-600. Label: "Supply: -15%"
5. **"Run Simulation" button** — primary-800, full width. Spinner during POST.

**Sections (right — results, fade-in after simulation):**
1. **Headline result** — "Predicted shortage: 3,200 kg" (large, danger color if shortage / success if surplus)
2. **Recommended actions list** — Each action as a card with icon:
   - ⚡ "Source from Rajasthan Mustard Collective (180 km away, 2,800 kg available)"
   - 💰 "Adjust price ceiling: +₹1.80/kg (new ceiling: ₹197/kg)"
   - 🚛 "Re-route Vehicle MH-AB-1234 to include alternate FPO pickup"
3. **Impact metrics row** — Farmer realization change: +6.4% (green) | Logistics cost change: -11.2% (green)
4. **Run history** — Last 5 simulation runs (collapsible).

**Data:** POST `/api/simulation/run`
**Actions:** Adjust sliders → Run. "Save scenario" → names and archives. Compare two runs side by side.

---

### SCREEN 43 — FPO & Batch Management (Admin)
**Type:** web
**Role:** ADMIN
**Route:** `/admin/fpos`

**Sections:**
1. **FPO table** — Name / State / Crop Types / Batches / Trust Score / Status. Row click → FPO detail panel slides in from right.
2. **Batch table** (tab switch) — Batch code / FPO / Crop / Status / Quality / Listing price / Actions (View / Override status)
3. **Override status** — Dropdown in admin batch row. Confirm dialog for any status change. Audit log mandatory.

---

### SCREEN 44 — Escrow Management (Admin)
**Type:** web
**Role:** ADMIN
**Route:** `/admin/escrow`

**Sections:**
1. **Summary strip** — Total held: ₹84,000 / Released today: ₹12,400 / Refunded: ₹2,100
2. **Escrow table** — Order ID / Buyer / Amount / Status / Held since / Actions: Release (with reason field) / Refund
3. **Filter tabs** — Held / Released / Disputed / Refunded
4. **Temperature breach flagged** — Separate tab. Orders where temp breach blocks auto-release. "Clear breach and release" action.

**Data:** GET `/api/admin/escrow`

---

### SCREEN 45 — DPI Integration Status
**Type:** web
**Role:** ADMIN
**Route:** `/admin/dpi`
**Palette:** info-blue for active integrations, warning for mock/sandbox

**Sections:**
1. **Heading** — "Government DPI Integration Status"
2. **Integration cards** (4 cards in 2×2 grid):
   - **AgriStack Farmer ID** — Status: "🟡 Sandbox / Mock". "10.31 crore Farmer IDs created nationally." "Production requires authorized state API access and farmer consent." API test button.
   - **eNAM Price Feed** — Status: "🟡 Mock Feed (static JSON)". Last updated. "Production requires eNAM API integration." Test button.
   - **ONDC SNP Adapter** — Status: "🟡 Sandbox". "BharatPure operates as ONDC Seller Network Participant." Catalog item count. "Production requires ONDC participant onboarding." Test button.
   - **UPI Payments** — Status: "✅ Simulated in prototype". "Payment references stored. Production requires payment gateway integration."
3. **Disclaimer banner** (warning-bg) — "All integrations shown in sandbox/mock mode. Production deployment requires formal API authorization from respective government bodies. Integration boundaries and data contracts are fully designed."
4. **ONDC Catalog Preview** — Table showing sample BharatPure batch formatted as ONDC catalog item. JSON view toggle.

**Data:** GET `/api/dpi/agristack/farmer/{mockId}` + GET `/api/dpi/enam/prices` + GET `/api/dpi/ondc/listings`

---

### SCREEN 46 — Audit Log Viewer (Admin)
**Type:** web
**Role:** ADMIN
**Route:** `/admin/audit`

**Sections:**
1. **Filters** — Entity type (select) / Entity ID (text) / Actor / Date range / Action type
2. **Audit table** — Timestamp / Actor / Role / Action / Entity / Old value / New value (expandable JSON diff)
3. **Export CSV button** — Downloads filtered audit log.

---

### SCREEN 47 — Buyer Reliability Score (Bulk Buyer self-view)
**Type:** web
**Role:** BULK_BUYER
**Route:** `/buyer/reliability`

**Sections:**
1. **Score hero** — Circular gauge: "89 / 100". Label: "Your Reliability Score".
2. **Breakdown bars** — Payment reliability / Order accuracy / Cancellation rate / Dispute rate
3. **How to improve** — Expandable tips: "Complete orders without cancelling," "Pay on time," etc.
4. **Score history** — Line chart showing score over last 6 months.

---

## COMPONENT LIBRARY — KEY CUSTOM COMPONENTS

These must be built as named wrappers in `frontend/src/components/shared/`:

```
<QualityBadge score={94} tier="NABL" />
  → Green pill (score ≥90), Amber (70-89), Red (<70)
  → Shows: "94/100 NABL" or "89/100 Rapid"

<BatchStatusPill status="listed" />
  → Color-coded pill per status per the state machine

<BIRTimeline events={birEvents} />
  → Vertical timeline, primary-600 dots, timestamp + event type + actor

<DemandSignal crop="TURMERIC" city="Delhi" delta={18} confidence={84} />
  → Compact card: crop icon + delta arrow + confidence bar

<IEIMetric label="Farmer Premium" before="₹22/kg" after="₹188/kg" delta="+754%" />
  → Stacked before/after comparison, green delta

<TrustScoreRing score={88.4} size="lg" />
  → Circular ring chart with score in center

<PriceRecommendationCard low={18200} high={19700} commodity={14000} premium={33.5} />
  → Gold-100 bg card with price range + premium %

<TemperatureStatusBadge maintained={true} maxTemp={7.4} threshold={8.0} />
  → Green "Maintained" or red "Breach Detected"

<DevOTPBanner otp="423819" />
  → Yellow dev-mode banner, dismissible, shows only when devOtp in API response
```

---

## PWA CONFIGURATION

```js
// vite.config.ts — vite-plugin-pwa config
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'icons/*.png'],
  manifest: {
    name: 'BharatPure',
    short_name: 'BharatPure',
    description: "India's farm-to-market trust network",
    theme_color: '#1B4332',
    background_color: '#1B4332',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\.bharatpure\.in\/api\/listings/,
        handler: 'NetworkFirst',
        options: { cacheName: 'listings-cache', expiration: { maxAgeSeconds: 300 } }
      },
      {
        urlPattern: /^https:\/\/api\.bharatpure\.in\/api\/qr\/scan/,
        handler: 'CacheFirst',
        options: { cacheName: 'bir-cache', expiration: { maxAgeSeconds: 86400 } }
      }
    ]
  }
})
```

Offline-first rules:
- Auth pages: always network (never serve stale auth).
- Listings: NetworkFirst (fresh data preferred, fallback to cache if offline).
- BIR / QR scan results: CacheFirst (provenance data is immutable, cache forever).
- Farmer batch create form: cache form state in IndexedDB via `idb-keyval` until submitted.

---

*End of BHARATPURE-UI.md — Batch 4 of 5*
*Next: BHARATPURE-AI.md — AI modules, WhatsApp bot, FastAPI routes, chatbot.md task board*
