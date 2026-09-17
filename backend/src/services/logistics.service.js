const { pool } = require('../db');
const logger = require('../utils/logger');
const { haversineKm } = require('../utils/geo');

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

  // Completing the cold-storage reroute stop resolves the review hold insertReroute's breach
  // originally created -- otherwise TEMP_BREACH_REVIEW is a dead end nothing ever clears.
  let coldStorageReviewResolved = false;
  if (stop.stop_type === 'HUB' && stop.batch_id) {
    const clearResult = await pool.query(
      `UPDATE batches SET notes = NULL, updated_at = NOW() WHERE id = $1 AND notes = 'TEMP_BREACH_REVIEW' RETURNING id`,
      [stop.batch_id],
    );
    if (clearResult.rows.length > 0) {
      await addBirEvent(pool, stop.batch_id, 'ColdStorageRerouted', { route_id: routeId, stop_id: stopId, resolved: true }, user.id, user.role);
      coldStorageReviewResolved = true;
    }
  }

  logger.info({ action: 'STOP_COMPLETED', routeId, stopId, userId: user.id, stopType: stop.stop_type, coldStorageReviewResolved });
  return { id: stopId, completed: true, order_delivery: orderDeliveryResult, cold_storage_review_resolved: coldStorageReviewResolved };
};

/**
 * Nearest active cold-storage facility to a given point, a plain Haversine scan -- no time-based/
 * multi-stop optimization, a single nearest-point lookup doesn't need the AI service's OR-Tools
 * solver (that's reserved for actual multi-stop route planning). Takes either the pool or an
 * active transaction client, since callers may or may not already be inside a transaction.
 * Returns null (not an error) when there's no active facility at all.
 */
const findNearestActiveFacility = async (dbClient, lat, lng) => {
  const facilitiesResult = await dbClient.query(
    `SELECT id, name, latitude, longitude FROM cold_storage_facilities WHERE status = 'active'`,
  );
  if (facilitiesResult.rows.length === 0) return null;

  let nearest = null;
  let nearestDistanceKm = Infinity;
  for (const facility of facilitiesResult.rows) {
    const distanceKm = haversineKm(lat, lng, Number(facility.latitude), Number(facility.longitude));
    if (distanceKm < nearestDistanceKm) {
      nearestDistanceKm = distanceKm;
      nearest = facility;
    }
  }
  return { facility: nearest, distanceKm: Math.round(nearestDistanceKm * 10) / 10 };
};

/**
 * Auto-reroute: inserts a stop at the nearest active cold-storage facility into the route's
 * not-yet-completed stops, right before whatever the driver's current next stop is. Returns null
 * (a no-op, not an error) when there's nothing to reroute against -- no breach position data
 * (location_lat/lng weren't sent) or no active facility exists -- since a reroute is a best-
 * effort addition on top of the always-succeeding breach-logging path, not something that should
 * ever block it.
 */
const insertReroute = async (client, routeId, batchId, breachLat, breachLng, actorUser) => {
  if (breachLat == null || breachLng == null) return null;

  const nearestResult = await findNearestActiveFacility(client, breachLat, breachLng);
  if (!nearestResult) return null;
  const { facility: nearest, distanceKm: nearestDistanceKm } = nearestResult;

  const pendingResult = await client.query(
    `SELECT MIN(sequence_number) AS next_seq FROM route_stops WHERE route_id = $1 AND completed_at IS NULL`,
    [routeId],
  );
  const nextSeq = pendingResult.rows[0].next_seq;
  if (nextSeq === null) return null; // route has no pending stops left to reroute ahead of

  await client.query(
    `UPDATE route_stops SET sequence_number = sequence_number + 1 WHERE route_id = $1 AND completed_at IS NULL`,
    [routeId],
  );
  const stopResult = await client.query(
    `INSERT INTO route_stops (route_id, batch_id, stop_type, sequence_number, location_name, latitude, longitude)
     VALUES ($1,$2,'HUB',$3,$4,$5,$6) RETURNING id`,
    [routeId, batchId, Number(nextSeq), nearest.name, nearest.latitude, nearest.longitude],
  );

  await addBirEvent(
    client, batchId, 'ColdStorageRerouted',
    { route_id: routeId, stop_id: stopResult.rows[0].id, facility_id: nearest.id, facility_name: nearest.name, distance_km: nearestDistanceKm },
    actorUser.id, actorUser.role,
  );

  return { stop_id: stopResult.rows[0].id, facility_name: nearest.name, distance_km: nearestDistanceKm };
};

/**
 * Logs a temperature reading. On breach: appends TemperatureBreachDetected, creates a
 * notification for ops, flags the batch via notes='TEMP_BREACH_REVIEW' -- status stays
 * 'dispatched' (per BHARATPURE-DB.md's documented edge case), it's the notes flag that blocks
 * markDelivered() later, not a status change -- and, when a route_id and current position are
 * available, auto-reroutes the driver to the nearest cold-storage facility (see insertReroute).
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

    let reroute = null;
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

      if (data.route_id) {
        reroute = await insertReroute(client, data.route_id, data.batch_id, data.location_lat ?? null, data.location_lng ?? null, user);
      }
    }

    await client.query('COMMIT');
    logger.info({ action: 'TEMPERATURE_LOGGED', batchId: data.batch_id, breachDetected, rerouted: Boolean(reroute) });
    return { breach_detected: breachDetected, reroute };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ action: 'TEMPERATURE_LOG_FAILED', batchId: data.batch_id, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { getDashboard, listRoutes, getRouteById, startRoute, completeStop, logTemperature, findNearestActiveFacility };
