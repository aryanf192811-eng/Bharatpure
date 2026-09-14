const { pool } = require('../db');
const logger = require('../utils/logger');
const { callAI } = require('./ai.service');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

/**
 * IEI (Intermediation Efficiency Index) — the exact query from BHARATPURE-DB.md's "Pattern 4".
 * Known data-sparsity caveat, not a bug: `price_intelligence` and completed `delivery_routes`
 * are never populated by anything in this codebase yet (price.service.js computes recommendations
 * on the fly rather than persisting them; route optimization needs the AI service, which doesn't
 * exist), so `avg_farmer_premium_rupees`/`avg_distance_saved_km`/`avg_logistics_saving_rupees`
 * will read as null/0 against the current seed data — the query is correct, the underlying data
 * just isn't dense enough yet for meaningful numbers. All 5 keys are always present in the
 * response regardless, which is what actually matters for the dashboard contract.
 */
const getIei = async ({ from, to, cropType }) => {
  const conditions = [`o.created_at > NOW() - INTERVAL '30 days'`];
  const params = [];
  if (from) {
    params.push(from);
    conditions.push(`o.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`o.created_at <= $${params.length}`);
  }
  if (cropType) {
    params.push(cropType);
    conditions.push(`b.crop_type = $${params.length}`);
  }
  // cropType requires the batches join; only add it when needed to keep the common case simple.
  const batchJoin = cropType ? `JOIN batches b ON b.id = oi.batch_id` : '';

  const result = await pool.query(
    `SELECT
       COUNT(DISTINCT o.id) AS total_orders,
       ROUND(AVG(
         (oi.price_per_kg_paise::DECIMAL / 100) -
         (COALESCE(pi.commodity_price_paise, 0)::DECIMAL / 100)
       ), 2) AS avg_farmer_premium_rupees,
       ROUND(AVG(dr.baseline_distance_km - dr.total_distance_km), 2) AS avg_distance_saved_km,
       ROUND(AVG((dr.baseline_cost_paise - dr.cost_estimate_paise)::DECIMAL / 100), 2) AS avg_logistics_saving_rupees,
       COUNT(CASE WHEN o.status = 'delivered' AND o.actual_delivery_at - o.created_at < INTERVAL '24 hours' THEN 1 END) AS settled_under_24h
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     ${batchJoin}
     LEFT JOIN price_intelligence pi ON pi.crop_type = (SELECT crop_type FROM batches WHERE id = oi.batch_id)
       AND pi.generated_at > NOW() - INTERVAL '7 days'
     LEFT JOIN delivery_routes dr ON dr.id = (
       SELECT id FROM delivery_routes WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1
     )
     WHERE ${conditions.join(' AND ')}`,
    params,
  );
  return result.rows[0];
};

const getDashboard = async () => {
  const [fpoCount, batchCount, orderCount, escrowHeld, disputeCount, demandAlerts, iei] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM fpo_profiles`),
    pool.query(`SELECT COUNT(*) FROM batches WHERE deleted_at IS NULL AND status NOT IN ('draft')`),
    pool.query(`SELECT COUNT(*) FROM orders`),
    pool.query(`SELECT COALESCE(SUM(amount_paise), 0) FROM escrow_transactions WHERE status = 'held'`),
    pool.query(`SELECT COUNT(*) FROM disputes WHERE status NOT IN ('resolved', 'dismissed')`),
    pool.query(
      `SELECT crop_type, city, predicted_kg, range_high_kg FROM demand_forecasts
       WHERE forecast_date >= CURRENT_DATE AND predicted_kg > range_high_kg * 0.9
       ORDER BY forecast_date ASC LIMIT 5`,
    ),
    getIei({}),
  ]);

  return {
    total_fpos: Number(fpoCount.rows[0].count),
    active_batches: Number(batchCount.rows[0].count),
    total_orders: Number(orderCount.rows[0].count),
    escrow_held_paise: Number(escrowHeld.rows[0].coalesce),
    open_disputes: Number(disputeCount.rows[0].count),
    demand_alerts: demandAlerts.rows,
    iei,
  };
};

const listBatches = async ({ status, fpoId, page = 1, limit = 20 }) => {
  const conditions = ['deleted_at IS NULL'];
  const params = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (fpoId) { params.push(fpoId); conditions.push(`fpo_id = $${params.length}`); }
  const offset = (page - 1) * limit;
  const countResult = await pool.query(`SELECT COUNT(*) FROM batches WHERE ${conditions.join(' AND ')}`, params);
  const dataResult = await pool.query(
    `SELECT id, batch_code, crop_type, status, quality_score, total_quantity_kg, remaining_quantity_kg, created_at
     FROM batches WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

const listUsers = async ({ role, status, page = 1, limit = 20 }) => {
  const conditions = ['deleted_at IS NULL'];
  const params = [];
  if (role) { params.push(role); conditions.push(`role = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  const offset = (page - 1) * limit;
  const countResult = await pool.query(`SELECT COUNT(*) FROM users WHERE ${conditions.join(' AND ')}`, params);
  const dataResult = await pool.query(
    `SELECT id, phone, email, role, status, full_name, created_at FROM users WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

const updateUserStatus = async (userId, admin, status, reason) => {
  const userResult = await pool.query(`SELECT status FROM users WHERE id = $1 AND deleted_at IS NULL`, [userId]);
  if (userResult.rows.length === 0) {
    throw apiError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  const oldStatus = userResult.rows[0].status;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`, [status, userId]);
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1,$2,'USER_STATUS_CHANGE','user',$3,$4,$5)`,
      [admin.id, admin.role, userId, JSON.stringify({ status: oldStatus }), JSON.stringify({ status, reason })],
    );
    await client.query('COMMIT');
    logger.info({ action: 'USER_STATUS_CHANGED', userId, status, adminId: admin.id });
    return { id: userId, status };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const listEscrow = async ({ status, page = 1, limit = 20 }) => {
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const countResult = await pool.query(`SELECT COUNT(*) FROM escrow_transactions ${whereClause}`, params);
  const dataResult = await pool.query(
    `SELECT id, order_id, amount_paise, status, held_at, released_at, refunded_at, refund_amount_paise
     FROM escrow_transactions ${whereClause} ORDER BY held_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

/**
 * Manual admin escrow release — reason is mandatory (unlike the automatic BIR-event-triggered
 * release in order.service.js's markDelivered). Always audit-logged.
 */
const releaseEscrow = async (escrowId, admin, reason) => {
  const escrowResult = await pool.query(`SELECT order_id, amount_paise, status FROM escrow_transactions WHERE id = $1`, [escrowId]);
  if (escrowResult.rows.length === 0) {
    throw apiError(404, 'ESCROW_NOT_FOUND', 'Escrow transaction not found.');
  }
  if (escrowResult.rows[0].status !== 'held') {
    throw apiError(422, 'ESCROW_NOT_HELD', 'This escrow is not currently held.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE escrow_transactions SET status = 'released', released_at = NOW(), release_triggered_by = 'MANUAL_ADMIN' WHERE id = $1`,
      [escrowId],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1,$2,'MANUAL_ESCROW_RELEASE','escrow_transaction',$3,$4,$5)`,
      [admin.id, admin.role, escrowId, JSON.stringify({ status: 'held' }), JSON.stringify({ status: 'released', reason })],
    );
    await client.query('COMMIT');
    logger.info({ action: 'ESCROW_MANUALLY_RELEASED', escrowId, adminId: admin.id });
    return { id: escrowId, status: 'released' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const listAuditLogs = async ({ entityType, entityId, page = 1, limit = 20 }) => {
  const conditions = [];
  const params = [];
  if (entityType) { params.push(entityType); conditions.push(`entity_type = $${params.length}`); }
  if (entityId) { params.push(entityId); conditions.push(`entity_id = $${params.length}`); }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const countResult = await pool.query(`SELECT COUNT(*) FROM audit_logs ${whereClause}`, params);
  const dataResult = await pool.query(
    `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

/**
 * Calls the AI service's route optimizer; on failure, reports it plainly rather than fabricating
 * a fake route (unlike demand/price, there's no reasonable local-formula fallback for a VRP
 * solve — this genuinely needs OR-Tools). Never 500s to the client either way.
 */
const optimizeRoutes = async (admin, data) => {
  const { data: aiData, error } = await callAI('POST', '/routing/optimize', { data });
  if (error || !aiData) {
    return { optimized: false, reason: 'AI routing service unavailable' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const routeIds = [];
    for (const vehicleRoute of aiData.routes ?? []) {
      // eslint-disable-next-line no-await-in-loop
      const routeResult = await client.query(
        `INSERT INTO delivery_routes (route_name, total_distance_km, vehicle_type, vehicle_id, status,
                                       baseline_distance_km, cost_estimate_paise, baseline_cost_paise)
         VALUES ($1,$2,$3,$4,'planned',$5,$6,$7) RETURNING id`,
        [
          vehicleRoute.route_name ?? null, aiData.total_distance_km ?? null, data.vehicle_type ?? null, vehicleRoute.vehicle_id ?? null,
          aiData.baseline_distance_km ?? null, aiData.cost_estimate_paise ?? null, aiData.baseline_cost_paise ?? null,
        ],
      );
      routeIds.push(routeResult.rows[0].id);
      for (const [i, stop] of (vehicleRoute.stops ?? []).entries()) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO route_stops (route_id, order_id, stop_type, sequence_number, location_name, latitude, longitude)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [routeResult.rows[0].id, stop.order_id ?? null, stop.stop_type ?? 'DELIVERY', i + 1, stop.name ?? null, stop.lat, stop.lng],
        );
      }
    }
    await client.query('COMMIT');
    logger.info({ action: 'ROUTES_OPTIMIZED', adminId: admin.id, routeCount: routeIds.length });
    return { optimized: true, route_ids: routeIds, savings_pct: aiData.savings_pct ?? null };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { getDashboard, getIei, listBatches, listUsers, updateUserStatus, listEscrow, releaseEscrow, listAuditLogs, optimizeRoutes };
