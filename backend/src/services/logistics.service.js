const { pool } = require('../db');
const logger = require('../utils/logger');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const addBirEvent = (client, batchId, eventType, eventData, actorId, actorRole) =>
  client.query(
    `INSERT INTO bir_events (batch_id, event_type, event_data, actor_id, actor_role) VALUES ($1,$2,$3,$4,$5)`,
    [batchId, eventType, JSON.stringify(eventData), actorId, actorRole],
  );

const getDashboard = async (user) => {
  const routesResult = await pool.query(
    `SELECT id, route_name, status, total_distance_km, optimized_at FROM delivery_routes WHERE driver_id = $1 ORDER BY optimized_at DESC`,
    [user.id],
  );
  const activeRoute = routesResult.rows.find((r) => r.status === 'in_progress') ?? null;
  const completedToday = routesResult.rows.filter(
    (r) => r.status === 'completed' && new Date(r.optimized_at).toDateString() === new Date().toDateString(),
  ).length;
  const pendingPickupsResult = await pool.query(
    `SELECT COUNT(*) FROM route_stops rs JOIN delivery_routes dr ON dr.id = rs.route_id
     WHERE dr.driver_id = $1 AND rs.stop_type = 'PICKUP' AND rs.completed_at IS NULL`,
    [user.id],
  );

  return {
    assigned_routes: routesResult.rows.length,
    completed_today: completedToday,
    active_route: activeRoute,
    pending_pickups: Number(pendingPickupsResult.rows[0].count),
  };
};

const listRoutes = async (user, { status, date }) => {
  const conditions = [];
  const params = [];
  if (user.role !== 'ADMIN') {
    params.push(user.id);
    conditions.push(`driver_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`optimized_at::date = $${params.length}`);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM delivery_routes ${whereClause} ORDER BY optimized_at DESC`, params);
  return result.rows;
};

const getRouteById = async (routeId, user) => {
  const routeResult = await pool.query(`SELECT * FROM delivery_routes WHERE id = $1`, [routeId]);
  if (routeResult.rows.length === 0) {
    throw apiError(404, 'ROUTE_NOT_FOUND', 'Route not found.');
  }
  const route = routeResult.rows[0];
  if (user.role !== 'ADMIN' && route.driver_id !== user.id) {
    throw apiError(404, 'ROUTE_NOT_FOUND', 'Route not found.');
  }
  const stopsResult = await pool.query(`SELECT * FROM route_stops WHERE route_id = $1 ORDER BY sequence_number ASC`, [routeId]);
  return { ...route, stops: stopsResult.rows };
};

const startRoute = async (routeId, user) => {
  const result = await pool.query(`SELECT driver_id, status FROM delivery_routes WHERE id = $1`, [routeId]);
  if (result.rows.length === 0) {
    throw apiError(404, 'ROUTE_NOT_FOUND', 'Route not found.');
  }
  if (result.rows[0].driver_id !== user.id && user.role !== 'ADMIN') {
    throw apiError(403, 'FORBIDDEN', 'This route is not assigned to you.');
  }
  if (result.rows[0].status !== 'planned') {
    throw apiError(422, 'ROUTE_ALREADY_STARTED', 'This route has already been started or completed.');
  }
  await pool.query(`UPDATE delivery_routes SET status = 'in_progress', started_at = NOW() WHERE id = $1`, [routeId]);
  logger.info({ action: 'ROUTE_STARTED', routeId, userId: user.id });
  return { id: routeId, status: 'in_progress' };
};

/**
 * Completing a DELIVERY-type stop is the pickup/delivery confirmation endpoint. For a DELIVERY
 * stop, this delegates to order.service's markDelivered() for the associated order internally,
 * per this task's spec ("if DELIVERY type, internally calls order delivered flow") -- passed
 * in as a parameter to avoid a require() cycle between logistics.service.js and order.service.js.
 */
const completeStop = async (routeId, stopId, user, notes, markOrderDelivered) => {
  const stopResult = await pool.query(
    `SELECT rs.*, dr.driver_id FROM route_stops rs JOIN delivery_routes dr ON dr.id = rs.route_id WHERE rs.id = $1 AND rs.route_id = $2`,
    [stopId, routeId],
  );
  if (stopResult.rows.length === 0) {
    throw apiError(404, 'STOP_NOT_FOUND', 'Stop not found.');
  }
  const stop = stopResult.rows[0];
  if (stop.driver_id !== user.id && user.role !== 'ADMIN') {
    throw apiError(403, 'FORBIDDEN', 'This route is not assigned to you.');
  }
  if (stop.completed_at !== null) {
    throw apiError(422, 'STOP_ALREADY_COMPLETED', 'This stop has already been completed.');
  }

  await pool.query(`UPDATE route_stops SET completed_at = NOW(), actual_arrival_at = NOW(), notes = $1 WHERE id = $2`, [notes ?? null, stopId]);

  let orderDeliveryResult = null;
  if (stop.stop_type === 'DELIVERY' && stop.order_id) {
    orderDeliveryResult = await markOrderDelivered(stop.order_id, user);
  }

  logger.info({ action: 'STOP_COMPLETED', routeId, stopId, userId: user.id, stopType: stop.stop_type });
  return { id: stopId, completed: true, order_delivery: orderDeliveryResult };
};

/**
 * Logs a temperature reading. On breach: appends TemperatureBreachDetected, creates a
 * notification for ops, and flags the batch via notes='TEMP_BREACH_REVIEW' -- status stays
 * 'dispatched' (per BHARATPURE-DB.md's documented edge case), it's the notes flag that blocks
 * markDelivered() later, not a status change.
 */
const logTemperature = async (user, data) => {
  const breachDetected = data.temperature_c > data.threshold_c;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO temperature_logs (batch_id, route_id, temperature_c, threshold_c, breach_detected, vehicle_id, location_lat, location_lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [data.batch_id, data.route_id ?? null, data.temperature_c, data.threshold_c, breachDetected, data.vehicle_id ?? null, data.location_lat ?? null, data.location_lng ?? null],
    );

    if (breachDetected) {
      await addBirEvent(
        client, data.batch_id, 'TemperatureBreachDetected',
        { temperature_c: data.temperature_c, breach_threshold_c: data.threshold_c, vehicle_id: data.vehicle_id ?? null, batch_held_for_review: true },
        user.id, user.role,
      );
      await client.query(`UPDATE batches SET notes = 'TEMP_BREACH_REVIEW', updated_at = NOW() WHERE id = $1`, [data.batch_id]);

      // Notify ops (every ADMIN) -- there's no dedicated "ops" role in this schema, ADMIN is it.
      const adminsResult = await client.query(`SELECT id FROM users WHERE role = 'ADMIN' AND status = 'active'`);
      for (const admin of adminsResult.rows) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES ($1,'TEMP_BREACH',$2,$3,$4)`,
          [
            admin.id, 'Cold chain temperature breach detected',
            `Batch reading ${data.temperature_c}°C exceeded the ${data.threshold_c}°C threshold. Review required before delivery.`,
            JSON.stringify({ batch_id: data.batch_id, route_id: data.route_id ?? null }),
          ],
        );
      }
    }

    await client.query('COMMIT');
    logger.info({ action: 'TEMPERATURE_LOGGED', batchId: data.batch_id, breachDetected });
    return { breach_detected: breachDetected };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ action: 'TEMPERATURE_LOG_FAILED', batchId: data.batch_id, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { getDashboard, listRoutes, getRouteById, startRoute, completeStop, logTemperature };
