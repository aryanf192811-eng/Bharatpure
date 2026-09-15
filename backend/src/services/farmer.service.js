const { pool } = require('../db');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const getFpoForUser = async (userId) => {
  const result = await pool.query(`SELECT * FROM fpo_profiles WHERE user_id = $1`, [userId]);
  if (result.rows.length === 0) {
    throw apiError(422, 'FPO_NOT_REGISTERED', 'No FPO profile found for this user.');
  }
  return result.rows[0];
};

const getProfile = async (userId) => {
  const fpo = await getFpoForUser(userId);
  const trustScoreResult = await pool.query(
    `SELECT computed_score, computed_at FROM fpo_trust_scores WHERE fpo_id = $1 ORDER BY computed_at DESC LIMIT 1`,
    [fpo.id],
  );
  const earningsResult = await pool.query(
    `SELECT COALESCE(SUM(oi.subtotal_paise), 0) AS total_earned_paise
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN escrow_transactions et ON et.order_id = o.id
     JOIN batches b ON b.id = oi.batch_id
     WHERE b.fpo_id = $1 AND et.status = 'released'`,
    [fpo.id],
  );
  return {
    ...fpo,
    latest_trust_score: trustScoreResult.rows[0] ?? null,
    total_earned_paise: Number(earningsResult.rows[0].total_earned_paise),
  };
};

/**
 * Demand signal per crop the FPO grows: the nearest upcoming forecast row for that crop type,
 * picked across any city (the farmer dashboard has no per-farmer target city in this schema --
 * BHARATPURE-API.md's example uses "Delhi" illustratively, not as a hard requirement). delta_pct
 * is derived (not a stored column): predicted_kg vs the midpoint of [range_low_kg, range_high_kg],
 * a documented simplification since demand_forecasts has no historical-baseline column to diff against.
 */
const getDemandSignals = async (cropTypes) => {
  if (cropTypes.length === 0) return [];
  const result = await pool.query(
    `SELECT DISTINCT ON (crop_type) crop_type, city, predicted_kg, confidence_pct, range_low_kg, range_high_kg
     FROM demand_forecasts
     WHERE crop_type = ANY($1) AND forecast_date >= CURRENT_DATE
     ORDER BY crop_type, forecast_date ASC`,
    [cropTypes],
  );
  return result.rows.map((row) => {
    const midpoint = (Number(row.range_low_kg) + Number(row.range_high_kg)) / 2;
    const demandDeltaPct = midpoint > 0 ? Math.round(((Number(row.predicted_kg) - midpoint) / midpoint) * 1000) / 10 : 0;
    return {
      crop_type: row.crop_type,
      city: row.city,
      predicted_kg: Number(row.predicted_kg),
      confidence_pct: Number(row.confidence_pct),
      demand_delta_pct: demandDeltaPct,
    };
  });
};

const getDashboard = async (userId) => {
  const fpo = await getFpoForUser(userId);

  const activeBatchesResult = await pool.query(
    `SELECT COUNT(*) FROM batches
     WHERE fpo_id = $1 AND deleted_at IS NULL
       AND status IN ('draft','pending_test','test_passed','listed','partially_sold','sold','dispatched')`,
    [fpo.id],
  );

  const paymentsResult = await pool.query(
    `SELECT
       COALESCE(SUM(oi.subtotal_paise) FILTER (WHERE et.status = 'held'), 0) AS pending_payments_paise,
       COALESCE(SUM(oi.subtotal_paise) FILTER (WHERE et.status = 'released'), 0) AS total_earned_paise
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN escrow_transactions et ON et.order_id = o.id
     JOIN batches b ON b.id = oi.batch_id
     WHERE b.fpo_id = $1`,
    [fpo.id],
  );

  const recentBatchesResult = await pool.query(
    `SELECT id, batch_code, crop_type, status, total_quantity_kg, remaining_quantity_kg, quality_score, created_at
     FROM batches WHERE fpo_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`,
    [fpo.id],
  );

  const demandSignals = await getDemandSignals(fpo.primary_crop_types);

  return {
    active_batches: Number(activeBatchesResult.rows[0].count),
    pending_payments_paise: Number(paymentsResult.rows[0].pending_payments_paise),
    total_earned_paise: Number(paymentsResult.rows[0].total_earned_paise),
    trust_score: fpo.trust_score !== null ? Number(fpo.trust_score) : null,
    demand_signals: demandSignals,
    recent_batches: recentBatchesResult.rows,
    // Procurement contracts are out of scope for this build -- per BHARATPURE-CLAUDE.md's own
    // documented Phase 1 cut line ("Procurement contracts deferred to demo script only").
    active_contracts: 0,
  };
};

const getEarnings = async (userId, { from, to }) => {
  const fpo = await getFpoForUser(userId);
  const params = [fpo.id];
  const conditions = [`b.fpo_id = $1`];
  if (from) { params.push(from); conditions.push(`o.created_at >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`o.created_at <= $${params.length}`); }

  const result = await pool.query(
    `SELECT b.id AS batch_id, b.batch_code, b.crop_type, b.status,
            SUM(oi.quantity_kg) AS quantity_sold_kg,
            SUM(oi.subtotal_paise) AS total_paise,
            ROUND(AVG(oi.price_per_kg_paise)) AS avg_price_per_kg_paise
     FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN batches b ON b.id = oi.batch_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY b.id, b.batch_code, b.crop_type, b.status
     ORDER BY MAX(o.created_at) DESC`,
    params,
  );
  return result.rows.map((row) => ({
    ...row,
    quantity_sold_kg: Number(row.quantity_sold_kg),
    total_paise: Number(row.total_paise),
    avg_price_per_kg_paise: Number(row.avg_price_per_kg_paise),
  }));
};

const getTrustScore = async (userId) => {
  const fpo = await getFpoForUser(userId);
  const result = await pool.query(
    `SELECT computed_score, fulfillment_rate, quality_consistency, on_time_delivery_rate,
            dispute_rate, buyer_rating_avg, total_batches, computed_at
     FROM fpo_trust_scores WHERE fpo_id = $1 ORDER BY computed_at DESC LIMIT 1`,
    [fpo.id],
  );
  if (result.rows.length === 0) {
    throw apiError(404, 'TRUST_SCORE_NOT_COMPUTED', 'Trust score has not been computed for this FPO yet.');
  }
  return result.rows[0];
};

module.exports = { getProfile, getDashboard, getEarnings, getTrustScore };
