const { pool } = require('../db');
const logger = require('../utils/logger');

const NEUTRAL_BUYER_RATING = 3.5; // placeholder: no ratings feature exists in this schema yet, see docs/research/trust-score-formula.md

// Credit-eligibility band thresholds. An FPO with fewer than MIN_BATCHES_FOR_SCORING batches
// gets INSUFFICIENT_DATA regardless of its computed score -- a high score built on 1-2 batches
// isn't a meaningful lending signal yet.
const MIN_BATCHES_FOR_SCORING = 5;
const HIGH_ELIGIBILITY_THRESHOLD = 75;
const MEDIUM_ELIGIBILITY_THRESHOLD = 50;
const BATCH_VOLUME_CAP = 50; // batches at which batch_volume_component maxes out at 100

/**
 * Computes and persists fpo_trust_scores + fpo_credit_scores + buyer_reliability_scores for
 * every FPO/buyer "with activity" (has at least one non-draft batch / at least one order), per
 * BHARATPURE-DB.md table 26's formula (given verbatim) and this task's own analogous buyer
 * formula (no formula was given for buyers — see the research doc for why weights were chosen
 * the way they were). Credit scoring rides in the same FPO loop as trust scoring since it reuses
 * that computation's trust score and dispute rate rather than a second full metrics pass.
 *
 * Known, documented data-sparsity gaps (not bugs): fulfillment_rate is always 0 (no
 * procurement_contracts are ever created anywhere in this codebase yet); on_time_delivery_rate
 * uses "order reached delivered" as a proxy since orders.estimated_delivery_at is never set;
 * buyer_rating_avg defaults to a neutral 3.5 since there's no ratings feature at all;
 * repayment_proxy_component uses escrow payout reliability as a stand-in for real loan
 * repayment history, which doesn't exist in this schema either.
 */
const runTrustScoreJob = async () => {
  const start = Date.now();
  const client = await pool.connect();
  try {
    const fpoResult = await client.query(`
      SELECT fp.id AS fpo_id
      FROM fpo_profiles fp
      WHERE EXISTS (SELECT 1 FROM batches b WHERE b.fpo_id = fp.id AND b.status != 'draft' AND b.deleted_at IS NULL)
    `);

    let fpoScoresComputed = 0;
    for (const { fpo_id: fpoId } of fpoResult.rows) {
      // eslint-disable-next-line no-await-in-loop -- small FPO count; sequential keeps each computation's logging clean
      const metricsResult = await client.query(
        `WITH fpo_batches AS (
           SELECT id FROM batches WHERE fpo_id = $1 AND status != 'draft' AND deleted_at IS NULL
         ),
         fpo_orders AS (
           SELECT DISTINCT o.id, o.status
           FROM orders o JOIN order_items oi ON oi.order_id = o.id
           WHERE oi.batch_id IN (SELECT id FROM fpo_batches)
         ),
         first_tests AS (
           SELECT DISTINCT ON (qt.batch_id) qt.batch_id, qt.result
           FROM quality_tests qt WHERE qt.batch_id IN (SELECT id FROM fpo_batches)
           ORDER BY qt.batch_id, qt.created_at ASC
         ),
         fpo_escrow AS (
           SELECT et.status
           FROM escrow_transactions et
           WHERE et.order_id IN (SELECT id FROM fpo_orders)
         )
         SELECT
           (SELECT COUNT(*) FROM fpo_batches) AS total_batches,
           COALESCE((SELECT COUNT(*) FILTER (WHERE result = 'PASS') * 100.0 / NULLIF(COUNT(*), 0) FROM first_tests), 0) AS quality_consistency,
           COALESCE((SELECT COUNT(*) FILTER (WHERE status = 'delivered') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE status != 'cancelled'), 0) FROM fpo_orders), 0) AS on_time_delivery_rate,
           COALESCE((
             SELECT COUNT(DISTINCT d.order_id) * 100.0 / NULLIF((SELECT COUNT(*) FROM fpo_orders), 0)
             FROM disputes d WHERE d.order_id IN (SELECT id FROM fpo_orders)
           ), 0) AS dispute_rate,
           COALESCE((SELECT COUNT(*) FILTER (WHERE status = 'released') * 100.0 / NULLIF(COUNT(*), 0) FROM fpo_escrow), 0) AS payment_reliability`,
        [fpoId],
      );
      const m = metricsResult.rows[0];
      const fulfillmentRate = 0; // documented gap -- no procurement_contracts data exists yet
      const qualityConsistency = Number(m.quality_consistency);
      const onTimeDeliveryRate = Number(m.on_time_delivery_rate);
      const disputeRate = Number(m.dispute_rate);
      const buyerRatingAvg = NEUTRAL_BUYER_RATING;
      const totalBatches = Number(m.total_batches);

      const computedScore = Number((
        fulfillmentRate * 0.30
        + qualityConsistency * 0.25
        + onTimeDeliveryRate * 0.20
        + (100 - disputeRate) * 0.15
        + buyerRatingAvg * 20 * 0.10
      ).toFixed(2));

      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO fpo_trust_scores (fpo_id, fulfillment_rate, quality_consistency, on_time_delivery_rate, dispute_rate, buyer_rating_avg, total_batches, computed_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [fpoId, fulfillmentRate, qualityConsistency, onTimeDeliveryRate, disputeRate, buyerRatingAvg, totalBatches, computedScore],
      );
      // eslint-disable-next-line no-await-in-loop
      await client.query(`UPDATE fpo_profiles SET trust_score = $1, updated_at = NOW() WHERE id = $2`, [computedScore, fpoId]);
      fpoScoresComputed += 1;

      // Micro-credit eligibility -- reuses this FPO's just-computed trust score and dispute rate
      // rather than a second full metrics pass. repaymentProxyComponent is a proxy for real loan
      // repayment history, which doesn't exist in this schema (same documented-gap pattern as
      // fulfillment_rate/buyer_rating_avg above) -- it's escrow payout reliability instead, the
      // closest real signal this codebase has for "does money reliably flow to this FPO without
      // disputes/holds."
      const trustScoreComponent = computedScore;
      const repaymentProxyComponent = Number(m.payment_reliability);
      const batchVolumeComponent = Math.min(100, Number(((totalBatches / BATCH_VOLUME_CAP) * 100).toFixed(2)));
      const disputePenaltyComponent = 100 - disputeRate;

      const creditScore = Number((
        trustScoreComponent * 0.40
        + repaymentProxyComponent * 0.30
        + batchVolumeComponent * 0.20
        + disputePenaltyComponent * 0.10
      ).toFixed(2));
      const eligibilityBand = totalBatches < MIN_BATCHES_FOR_SCORING ? 'INSUFFICIENT_DATA'
        : creditScore >= HIGH_ELIGIBILITY_THRESHOLD ? 'HIGH'
        : creditScore >= MEDIUM_ELIGIBILITY_THRESHOLD ? 'MEDIUM'
        : 'LOW';

      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO fpo_credit_scores (fpo_id, trust_score_component, repayment_proxy_component, batch_volume_component, dispute_penalty_component, computed_score, eligibility_band)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [fpoId, trustScoreComponent, repaymentProxyComponent, batchVolumeComponent, disputePenaltyComponent, creditScore, eligibilityBand],
      );
    }

    const buyerResult = await client.query(`
      SELECT DISTINCT buyer_id FROM orders WHERE buyer_role IN ('CONSUMER', 'BULK_BUYER')
    `);

    let buyerScoresComputed = 0;
    for (const { buyer_id: buyerId } of buyerResult.rows) {
      // eslint-disable-next-line no-await-in-loop
      const metricsResult = await client.query(
        `WITH buyer_orders AS (SELECT id, status FROM orders WHERE buyer_id = $1),
         buyer_escrow AS (SELECT status FROM escrow_transactions WHERE order_id IN (SELECT id FROM buyer_orders))
         SELECT
           (SELECT COUNT(*) FROM buyer_orders) AS total_orders,
           COALESCE((SELECT COUNT(*) FILTER (WHERE status = 'released') * 100.0 / NULLIF(COUNT(*), 0) FROM buyer_escrow), 0) AS payment_reliability,
           COALESCE((SELECT COUNT(*) FILTER (WHERE status != 'cancelled') * 100.0 / NULLIF(COUNT(*), 0) FROM buyer_orders), 0) AS order_accuracy,
           COALESCE((SELECT COUNT(*) FILTER (WHERE status = 'cancelled') * 100.0 / NULLIF(COUNT(*), 0) FROM buyer_orders), 0) AS cancellation_rate,
           COALESCE((
             SELECT COUNT(DISTINCT d.order_id) * 100.0 / NULLIF((SELECT COUNT(*) FROM buyer_orders), 0)
             FROM disputes d WHERE d.order_id IN (SELECT id FROM buyer_orders)
           ), 0) AS dispute_rate`,
        [buyerId],
      );
      const m = metricsResult.rows[0];
      const paymentReliability = Number(m.payment_reliability);
      const orderAccuracy = Number(m.order_accuracy);
      const cancellationRate = Number(m.cancellation_rate);
      const disputeRate = Number(m.dispute_rate);

      const computedScore = Number((
        paymentReliability * 0.35
        + orderAccuracy * 0.30
        + (100 - cancellationRate) * 0.20
        + (100 - disputeRate) * 0.15
      ).toFixed(2));

      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO buyer_reliability_scores (buyer_id, payment_reliability, order_accuracy, cancellation_rate, dispute_rate, computed_score)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [buyerId, paymentReliability, orderAccuracy, cancellationRate, disputeRate, computedScore],
      );
      buyerScoresComputed += 1;
    }

    const durationMs = Date.now() - start;
    logger.info({ action: 'TRUST_SCORE_JOB_COMPLETE', fpoScoresComputed, buyerScoresComputed, durationMs });
    return {
      fpo_scores_computed: fpoScoresComputed,
      credit_scores_computed: fpoScoresComputed, // one credit score is computed per FPO trust score, in the same loop
      buyer_scores_computed: buyerScoresComputed,
      duration_ms: durationMs,
    };
  } catch (err) {
    logger.error({ action: 'TRUST_SCORE_JOB_FAILED', err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { runTrustScoreJob };
