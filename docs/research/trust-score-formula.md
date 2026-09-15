# Research: FPO Trust Score & Buyer Reliability Score formulas
Date: 2026-09-16
Task context: TASK-P5-003 (nightly cron jobs)

## Question
BHARATPURE-DB.md table 26 (`fpo_trust_scores`) gives an explicit weighted formula for
`computed_score`, but doesn't give the underlying SQL for each of its 5 inputs
(`fulfillment_rate`, `quality_consistency`, `on_time_delivery_rate`, `dispute_rate`,
`buyer_rating_avg`) — those have to be derived from the schema's other tables. Table 27
(`buyer_reliability_scores`) doesn't even give a formula, only the 4 input columns.

## Findings

### FPO trust score — the formula itself (given, verbatim)
```
computed_score =
  (fulfillment_rate * 0.30) +
  (quality_consistency * 0.25) +
  (on_time_delivery_rate * 0.20) +
  ((100 - dispute_rate) * 0.15) +
  (buyer_rating_avg * 20 * 0.10)
```

### FPO trust score — what each input actually measures in this codebase, and real gaps found
- **`fulfillment_rate`** ("% of contracted quantity actually delivered", per the column comment)
  requires `procurement_contracts` data linked to `batches.contract_id`. **This codebase's seed
  data never creates any procurement contracts** — `seed.js` (TASK-P1) doesn't touch that table
  at all, and no route in this task board creates one either (contracts CRUD isn't in the
  chatbot.md task list). So this component is honestly `0` for every FPO right now, not a bug —
  there's simply no contract-fulfillment data to compute it from yet.
- **`quality_consistency`** ("% of batches passing quality at first test") — computable directly:
  for each FPO's batches, look at their earliest `quality_tests` row by `created_at` and check
  `result = 'PASS'`.
- **`on_time_delivery_rate`** — the schema has no SLA/expected-delivery-window field that's
  actually populated (`orders.estimated_delivery_at` is never set by `order.service.js`'s
  `createOrder`, TASK-P3-001). Used a practical proxy instead: % of this FPO's orders (orders
  containing at least one of their batches) that reached `status='delivered'` out of all their
  non-cancelled orders — i.e., "did the order complete" rather than "did it complete on time
  against a target," since no target exists to measure against.
- **`dispute_rate`** — computable directly: disputes on orders containing this FPO's batches, as
  a % of their total orders.
- **`buyer_rating_avg`** — **there is no buyer-rating feature anywhere in the 33-table schema.**
  No `ratings` table, no rating column on `disputes` or `orders`. Defaulted to a neutral `3.5`
  (a fair "no ratings collected yet" midpoint on a 1–5 scale) rather than `NULL`, since `NULL`
  would break the weighted sum. This is a placeholder for a feature that doesn't exist yet.

### Buyer reliability score — no formula given, designed one analogous to the FPO formula
Following the same weighting philosophy (primary reliability signal weighted heaviest, penalty
metrics inverted via `100 - x`, weights summing to 1.0):
```
computed_score =
  (payment_reliability * 0.35) +
  (order_accuracy * 0.30) +
  ((100 - cancellation_rate) * 0.20) +
  ((100 - dispute_rate) * 0.15)
```
- `payment_reliability`: % of this buyer's `escrow_transactions` with `status = 'released'`
  (settled cleanly) out of all their escrow transactions (released + refunded + partially_refunded).
- `order_accuracy`: % of their orders NOT `status = 'cancelled'`.
- `cancellation_rate`: % of their orders that ARE `status = 'cancelled'`.
- `dispute_rate`: disputes on their orders as a % of their total orders.

## Decision
Implement both formulas as designed above, with the data-sparsity gaps (no contracts, no SLA
field, no ratings feature) documented in code comments at the query site, not silently smoothed
over. `computed_score` will still be meaningfully non-zero for the 3 seeded FPOs because
`quality_consistency` + the inverted `dispute_rate` term + the neutral `buyer_rating_avg`
placeholder together carry 50% of the formula's weight and have real underlying data.

"FPO with activity" (per this task's spec — "all FPOs with activity") is defined as: has at
least one non-`draft` batch. All 3 seeded FPOs qualify.

## Sources
- `BHARATPURE-DB.md` table 26 (lines 888–917) and table 27 (lines 920–934) — read directly,
  not from an earlier summarized digest.
- `chatbot.md` TASK-P5-003 spec and acceptance check.
- This session's own `seed.js` (TASK-P1-010) and `order.service.js` (TASK-P3-001) — checked
  directly to confirm the "no contracts seeded" / "no estimated_delivery_at set" gaps are real,
  not assumed.
