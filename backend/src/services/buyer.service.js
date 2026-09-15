const { pool } = require('../db');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const getProfile = async (userId) => {
  const profileResult = await pool.query(`SELECT * FROM bulk_buyer_profiles WHERE user_id = $1`, [userId]);
  if (profileResult.rows.length === 0) {
    throw apiError(422, 'BUYER_NOT_REGISTERED', 'No bulk buyer profile found for this user.');
  }
  const latestResult = await pool.query(
    `SELECT computed_score, computed_at FROM buyer_reliability_scores WHERE buyer_id = $1 ORDER BY computed_at DESC LIMIT 1`,
    [userId],
  );
  return { ...profileResult.rows[0], latest_reliability_score: latestResult.rows[0] ?? null };
};

const getDashboard = async (userId) => {
  const activeOrdersResult = await pool.query(
    `SELECT COUNT(*) FROM orders WHERE buyer_id = $1 AND status IN ('placed','confirmed','allocation_pending','allocated','dispatched')`,
    [userId],
  );
  const spentResult = await pool.query(
    `SELECT COALESCE(SUM(total_amount_paise), 0) AS total_spent_paise FROM orders WHERE buyer_id = $1 AND status != 'cancelled'`,
    [userId],
  );
  const escrowResult = await pool.query(
    `SELECT COALESCE(SUM(et.amount_paise), 0) AS escrow_held_paise
     FROM escrow_transactions et JOIN orders o ON o.id = et.order_id
     WHERE o.buyer_id = $1 AND et.status = 'held'`,
    [userId],
  );
  const latestScoreResult = await pool.query(
    `SELECT computed_score FROM buyer_reliability_scores WHERE buyer_id = $1 ORDER BY computed_at DESC LIMIT 1`,
    [userId],
  );

  return {
    active_orders: Number(activeOrdersResult.rows[0].count),
    total_spent_paise: Number(spentResult.rows[0].total_spent_paise),
    escrow_held_paise: Number(escrowResult.rows[0].escrow_held_paise),
    reliability_score: latestScoreResult.rows[0] ? Number(latestScoreResult.rows[0].computed_score) : null,
  };
};

const getReliability = async (userId) => {
  const result = await pool.query(
    `SELECT payment_reliability, order_accuracy, cancellation_rate, dispute_rate, computed_score, computed_at
     FROM buyer_reliability_scores WHERE buyer_id = $1 ORDER BY computed_at DESC LIMIT 12`,
    [userId],
  );
  if (result.rows.length === 0) {
    throw apiError(404, 'RELIABILITY_SCORE_NOT_COMPUTED', 'Reliability score has not been computed yet.');
  }
  return { latest: result.rows[0], history: result.rows.reverse() };
};

module.exports = { getProfile, getDashboard, getReliability };
