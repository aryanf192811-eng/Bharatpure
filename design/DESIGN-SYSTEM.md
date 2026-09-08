# BharatPure Design System — Reconciliation Spec
> Bridges the Stitch export (which improvised a parallel Material-3 token layer) back to the single
> canonical system defined in `BHARATPURE-UI.md`. Every evolved screen must use ONLY the tokens below.
> Verified against the `ui-ux-pro-max` skill (`.claude/skills/ui-ux-pro-max`) — `--stack html-tailwind`,
> `--domain ux`, `--domain icons` — 2026-09-08. Where BHARATPURE-UI.md already specifies an exact value
> (radius, spacing, shadow scale), that spec wins over the generic stack default.

## 1. Canonical Tailwind config (paste verbatim into every screen's `tailwind.config`)

```js
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: { 50:'#F0FDF4', 100:'#D8F3DC', 400:'#74C69D', 500:'#52B788', 600:'#40916C', 700:'#2D6A4F', 800:'#1B4332', 900:'#0D2818' },
        gold:    { 50:'#FFFBEB', 100:'#FDF3D0', 400:'#E9B949', 600:'#C8971A', 800:'#92650A' },
        earth:   { 50:'#FDF8F0', 100:'#F5F0E8', 200:'#E2D9CC', 500:'#9B8B72', 700:'#5C4F38', 900:'#1C1408' },
        terracotta: { 100:'#FFEDD5', 400:'#E8795F', 600:'#C4522A', 700:'#9A3412' },
        success: '#2D6A4F', 'success-bg': '#D1FAE5',
        warning: '#E8841A', 'warning-bg': '#FEF3C7',
        danger:  '#C4522A', 'danger-bg':  '#FEE2E2',
        info:    '#1D6FA4', 'info-bg':    '#E0F2FE',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body:    ['Inter', '-apple-system', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      borderRadius: { sharp:'2px', sm:'4px', DEFAULT:'8px', md:'12px', lg:'16px' },
      boxShadow: {
        sm:  '0 1px 2px rgba(28,20,8,.06)',
        md:  '0 4px 12px rgba(28,20,8,.08)',
        lg:  '0 8px 24px rgba(28,20,8,.12)',
        xl:  '0 16px 40px rgba(28,20,8,.16)',
        inner: 'inset 0 2px 4px rgba(28,20,8,.06)',
      },
    },
  },
};
```

Background: `bg-earth-50` (page canvas). Cards: `bg-white`. Never introduce a raw hex value or a new color key outside this block.

## 2. Token reconciliation — Stitch/Material-3 class → canonical class

Do a full find/replace per screen. Left column is what Stitch emitted; right is what must remain.

| Stitch / M3 utility suffix | Canonical replacement |
|---|---|
| `surface`, `surface-bright` | `earth-50` |
| `surface-dim` | `earth-200` |
| `surface-container-lowest` | `white` |
| `surface-container-low`, `surface-container` | `earth-100` |
| `surface-container-high`, `surface-container-highest`, `surface-variant` | `earth-200` |
| `on-surface`, `on-background`, `background`(text use) | `earth-900` |
| `on-surface-variant` | `earth-700` |
| `outline` | `earth-500` |
| `outline-variant` | `earth-200` |
| `inverse-surface` | `primary-900` |
| `inverse-on-surface` | `earth-50` |
| `surface-tint` | `primary-700` |
| `primary` (M3 role, hex `#012d1d`) | `primary-800` (do NOT keep the off-brand `#012d1d`) |
| `on-primary` | `white` |
| `primary-container` | `primary-800` (hex already matched exactly) |
| `on-primary-container`, `inverse-primary` | `primary-400` |
| `primary-fixed`, `primary-fixed-dim` | `primary-100` / `primary-400` |
| `on-primary-fixed`, `on-primary-fixed-variant` | `primary-900` / `primary-700` |
| `secondary` (M3 role) | `gold-800` |
| `on-secondary` | `white` |
| `secondary-container` | `gold-400` |
| `on-secondary-container` | `gold-800` |
| `secondary-fixed`, `secondary-fixed-dim` | `gold-100` / `gold-400` |
| `on-secondary-fixed`, `on-secondary-fixed-variant` | `gold-800` |
| `tertiary`, `tertiary-container` | `terracotta-700` / `terracotta-600` |
| `on-tertiary`, `on-tertiary-container` | `white` / `terracotta-700` |
| `tertiary-fixed`, `tertiary-fixed-dim` | `terracotta-100` / `terracotta-400` |
| `error`, `on-error` | `danger` / `white` |
| `error-container`, `on-error-container` | `danger-bg` / `terracotta-700` |
| **Already-correct custom keys — direct rename only:** | |
| `primary-dark` | `primary-900` |
| `primary-mid` | `primary-700` |
| `primary-light` | `primary-500` |
| `primary-subtle` | `primary-100` |
| `primary-surface` | `primary-50` |
| `gold-dark` | `gold-800` |
| `gold-light` | `gold-400` |
| `gold-subtle` | `gold-100` |
| `gold-surface` | `gold-50` |
| `surface-card` | `white` |
| `surface-alt` | `earth-100` |
| `border-warm` | `earth-200` |
| `text-primary` (custom key, not M3 role) | `earth-900` |
| `text-secondary` | `earth-700` |
| `text-muted` | `earth-500` |
| `warning` (custom, already `#E8841A`) | keep as `warning` |

## 3. Typography reconciliation

Drop the custom `fontSize.*` keys Stitch invented (`display-lg`, `headline-md`, etc.) entirely — they duplicate Tailwind's scale under different names and drift from the canon max (36px). Use plain Tailwind size utilities + explicit font family/weight:

| Stitch key | Canonical replacement |
|---|---|
| `display-lg`, `display-lg-mobile` | `font-display text-4xl font-bold` |
| `headline-lg` | `font-display text-3xl font-semibold` |
| `headline-md` | `font-display text-2xl font-semibold` |
| `headline-sm` | `font-display text-xl font-semibold` |
| `title-lg` | `font-body text-lg font-semibold` |
| `body-lg` | `font-body text-base font-normal` |
| `body-md` | `font-body text-sm font-normal` |
| `body-sm` | `font-body text-xs font-normal` |
| `label-code-lg` | `font-mono text-sm font-medium tracking-wide` |
| `label-code-sm` | `font-mono text-xs font-medium tracking-wider uppercase` |

Headings → `font-display` (Playfair Display). Body/UI/labels → `font-body` (Inter). Batch codes, cert numbers, hashes → `font-mono` (JetBrains Mono). Never leave a class referencing the old custom fontSize key.

## 4. UX upgrades to apply (verified via ui-ux-pro-max, not present in the raw Stitch output)

1. **Focus-visible states (missing everywhere in the raw export)** — every button, link, input, and tappable card gets `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2`. (`ux-guidelines.csv` → Focus States, severity High.)
2. **Hover/press feedback on interactive cards** — add `transition-shadow hover:shadow-md active:scale-[0.99]` (or the project's existing `active:scale-[0.99]` pattern — keep it, just make it consistent everywhere a card/button is tappable).
3. **Touch targets** — verify every tappable element is ≥44×44px; pad icon-only buttons rather than shrinking the hit area.
4. **Spacing rhythm** — use only BharatPure's own scale (4/8/12/16/24/32/48/64px, i.e. Tailwind `1/2/3/4/6/8/12/16`). Replace any arbitrary `p-[15px]`-style values found in the export.
5. **Radius per component type (per BHARATPURE-UI.md, not the generic `rounded-2xl` stack default)** — cards/panels `rounded` (8px), modals/larger cards `rounded-md` (12px), bottom sheets/action sheets `rounded-lg` (16px), pills/badges/avatars `rounded-full`.
6. **Icon discipline** — functional/structural icons (nav, arrows, checkmarks, status) stay on Material Symbols Outlined (already loaded via the Google Fonts link — keep it). Decorative crop/role emoji (🌾🛒🏢🚚🏛️) are acceptable ONLY when they sit beside a real text label, never as the sole signal of meaning or as a nav/action icon.
7. **`prefers-reduced-motion`** — any custom CSS animation (pulse, shimmer) must be wrapped so it's disabled under `@media (prefers-reduced-motion: reduce)`.

## 5. What NOT to change

- Do not alter page structure, section order, copy, or JS interaction logic — this is a token/typography/accessibility reconciliation pass, not a redesign.
- Do not introduce new npm/CDN dependencies beyond what's already loaded (Tailwind CDN, Google Fonts, Material Symbols).
- Keep the `pt-safe`/`pb-safe` safe-area classes and the `overscroll-behavior: none` / hidden-scrollbar base styles as-is — already correct.

## 6. Output convention

Evolved file goes to `design/evolved/<same-folder-name-as-source>/index.html`. Do not overwrite the original Stitch export files (kept out of git under `stitch_export/`, ignored). Reference screenshots stay in the original `screen.png` per folder for before/after comparison.
