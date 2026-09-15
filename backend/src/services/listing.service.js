const axios = require('axios');

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

/**
 * Best-effort call to the AI Decision Engine's price-recommendation endpoint. The FastAPI
 * service (BHARATPURE-AI.md) isn't built yet in this codebase -- per BHARATPURE-CLAUDE.md's own
 * rule ("AI service failures must never surface as 500 to end users"), a listing must still be
 * created successfully even when this fails or the service doesn't exist at all. Returns null on
 * any failure rather than throwing.
 */
const fetchPriceRecommendation = async (cropType, qualityScore, city) => {
  if (!process.env.AI_SERVICE_URL) return null;
  try {
    const { data } = await axios.get(`${process.env.AI_SERVICE_URL}/price/recommendation`, {
      params: { crop_type: cropType, quality_score: qualityScore, city },
      timeout: 3000,
    });
    return data;
  } catch (err) {
    logger.error({ action: 'PRICE_RECOMMENDATION_UNAVAILABLE', cropType, err: err.message });
    return null;
  }
};

/**
 * Creates a listing from a test_passed batch: sets batch -> listed, appends BatchListed,
 * fetches (best-effort) a price recommendation for context -- all the DB work happens in one
 * transaction; the AI call happens after commit since it's advisory only and must never block
 * or roll back the actual listing.
 */
const createListing = async (user, data) => {
  const client = await pool.connect();
  try {
    const batchResult = await client.query(
      `SELECT id, fpo_id, crop_type, quality_score, status FROM batches WHERE id = $1 AND deleted_at IS NULL`,
      [data.batch_id],
    );
    if (batchResult.rows.length === 0) {
      throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    }
    const batch = batchResult.rows[0];

    if (user.role !== 'ADMIN') {
      const fpoResult = await client.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
      if (fpoResult.rows.length === 0 || fpoResult.rows[0].id !== batch.fpo_id) {
        throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
      }
    }

    // Checked before the status guard: once a batch is listed its status moves to 'listed', which
    // would otherwise always mask a duplicate-listing attempt behind the generic BATCH_NOT_READY
    // (422) instead of the more specific BATCH_ALREADY_LISTED (409) documented in BHARATPURE-API.md.
    const existingListing = await client.query(
      `SELECT id FROM listings WHERE batch_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [data.batch_id],
    );
    if (existingListing.rows.length > 0) {
      throw apiError(409, 'BATCH_ALREADY_LISTED', 'This batch already has an active listing.');
    }

    if (batch.status !== 'test_passed') {
      throw apiError(422, 'BATCH_NOT_READY', 'Batch must pass quality testing before it can be listed.');
    }

    await client.query('BEGIN');
    const listingResult = await client.query(
      `INSERT INTO listings (batch_id, listed_by, price_per_kg_paise, min_order_kg, max_order_kg, listing_type, available_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        data.batch_id, user.id, data.price_per_kg_paise, data.min_order_kg ?? 1.0, data.max_order_kg ?? null,
        data.listing_type ?? 'OPEN', data.available_until ?? null,
      ],
    );
    await client.query(`UPDATE batches SET status = 'listed', updated_at = NOW() WHERE id = $1`, [data.batch_id]);
    await addBirEvent(client, data.batch_id, 'BatchListed', { price_per_kg_paise: data.price_per_kg_paise }, user.id, user.role);
    await client.query('COMMIT');

    logger.info({ action: 'LISTING_CREATED', listingId: listingResult.rows[0].id, batchId: data.batch_id });

    // Best-effort, post-commit, never blocks or fails the listing itself.
    const priceRecommendation = await fetchPriceRecommendation(batch.crop_type, batch.quality_score, data.city);

    return { id: listingResult.rows[0].id, batch_id: data.batch_id, price_per_kg_paise: data.price_per_kg_paise, price_recommendation: priceRecommendation };
  } catch (err) {
    await client.query('ROLLBACK'); // safe no-op if BEGIN was never reached
    if (err.code && err.statusCode) throw err;
    logger.error({ action: 'LISTING_CREATE_FAILED', userId: user.id, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Role-scoped listing browse, with a best-effort demand_forecast join by crop_type + city (the
 * nearest upcoming forecast_date on/after today) — reads the demand_forecasts cache table
 * directly rather than calling the AI service live, matching how that table is documented to
 * work (a periodically-refreshed cache, not a live-call-per-request source).
 */
const listListings = async (user, { cropType, city, minQuality, page = 1, limit = 20 }) => {
  // Base conditions every role needs. FARMER deliberately does NOT get l.status='active' here
  // (they should see all their own listings, including paused/sold_out/cancelled), everyone
  // else does.
  const conditions = [`l.deleted_at IS NULL`, `b.deleted_at IS NULL`];
  const params = [];

  if (user.role === 'FARMER') {
    const fpoResult = await pool.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
    if (fpoResult.rows.length === 0) return { rows: [], total: 0 };
    params.push(fpoResult.rows[0].id);
    conditions.push(`b.fpo_id = $${params.length}`);
  } else if (user.role === 'CONSUMER') {
    conditions.push(`l.status = 'active'`);
    conditions.push(`l.listing_type IN ('OPEN', 'CONSUMER_ONLY')`);
  } else if (user.role === 'BULK_BUYER') {
    conditions.push(`l.status = 'active'`);
    conditions.push(`l.listing_type IN ('OPEN', 'BULK_ONLY')`);
  } else {
    // ADMIN: sees everything regardless of status.
  }

  if (cropType) {
    params.push(cropType);
    conditions.push(`b.crop_type = $${params.length}`);
  }
  if (minQuality) {
    params.push(minQuality);
    conditions.push(`b.quality_score >= $${params.length}`);
  }

  const offset = (page - 1) * limit;
  // city is always passed as a parameter (null when absent) so the parameter count/indices
  // stay consistent regardless of whether the caller provided one -- avoids a conditional
  // index shift that's easy to get wrong (an earlier draft of this query did get it wrong).
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const cityIdx = params.length + 3;
  const queryParams = [...params, limit, offset, city ?? null];

  const countResult = await pool.query(`SELECT COUNT(*) FROM listings l JOIN batches b ON b.id = l.batch_id WHERE ${conditions.join(' AND ')}`, params);
  const dataResult = await pool.query(
    `SELECT l.id, l.batch_id, l.price_per_kg_paise, l.min_order_kg, l.max_order_kg, l.listing_type, l.status,
            b.batch_code, b.crop_type, b.quality_score,
            df.predicted_kg AS demand_forecast_kg, df.confidence_pct AS demand_confidence_pct
     FROM listings l
     JOIN batches b ON b.id = l.batch_id
     LEFT JOIN LATERAL (
       SELECT predicted_kg, confidence_pct FROM demand_forecasts
       WHERE crop_type = b.crop_type AND ($${cityIdx}::text IS NULL OR city = $${cityIdx})
         AND forecast_date >= CURRENT_DATE
       ORDER BY forecast_date ASC LIMIT 1
     ) df ON TRUE
     WHERE ${conditions.join(' AND ')}
     ORDER BY l.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    queryParams,
  );

  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

const getListingById = async (listingId) => {
  const result = await pool.query(
    `SELECT l.*, b.batch_code, b.crop_type, b.quality_score, b.harvest_date, c.name AS cluster_name, c.state, c.district
     FROM listings l JOIN batches b ON b.id = l.batch_id JOIN clusters c ON c.id = b.cluster_id
     WHERE l.id = $1 AND l.deleted_at IS NULL`,
    [listingId],
  );
  if (result.rows.length === 0) {
    throw apiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }
  return result.rows[0];
};

const hasPendingOrders = async (listingId) => {
  const result = await pool.query(
    `SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.listing_id = $1 AND o.status IN ('placed','confirmed','allocation_pending','allocated','dispatched') LIMIT 1`,
    [listingId],
  );
  return result.rows.length > 0;
};

const assertOwnership = async (listingId, user) => {
  const result = await pool.query(`SELECT l.listed_by, b.fpo_id FROM listings l JOIN batches b ON b.id = l.batch_id WHERE l.id = $1`, [listingId]);
  if (result.rows.length === 0) {
    throw apiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }
  if (user.role !== 'ADMIN' && result.rows[0].listed_by !== user.id) {
    throw apiError(403, 'FORBIDDEN', 'You do not own this listing.');
  }
};

const updateListing = async (listingId, user, data) => {
  await assertOwnership(listingId, user);

  if (data.price_per_kg_paise !== undefined && (await hasPendingOrders(listingId))) {
    throw apiError(422, 'PRICE_CHANGE_BLOCKED_PENDING_ORDERS', 'Cannot change price while orders are pending on this listing.');
  }

  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(data)) {
    params.push(value);
    fields.push(`${key} = $${params.length}`);
  }
  if (fields.length === 0) return getListingById(listingId);

  params.push(listingId);
  await pool.query(`UPDATE listings SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
  logger.info({ action: 'LISTING_UPDATED', listingId, userId: user.id });
  return getListingById(listingId);
};

const updateListingStatus = async (listingId, user, status) => {
  await assertOwnership(listingId, user);

  if (status === 'cancelled' && (await hasPendingOrders(listingId))) {
    throw apiError(422, 'CANNOT_CANCEL_PENDING_ORDERS', 'Cannot cancel a listing with pending orders.');
  }

  await pool.query(`UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2`, [status, listingId]);
  logger.info({ action: 'LISTING_STATUS_UPDATED', listingId, status, userId: user.id });
  return { id: listingId, status };
};

/**
 * "Top 5 ranked by demand+trust+quality" per BHARATPURE-API.md. FPO trust scores aren't
 * computed yet (that's Phase 5's nightly cron job, TASK-P5-003) -- ranks by demand match +
 * quality_score only for now; trust-score weighting is a documented simplification, not a
 * silently-dropped requirement.
 */
const getRecommended = async (user, city) => {
  const result = await pool.query(
    `SELECT l.id, l.batch_id, l.price_per_kg_paise, b.batch_code, b.crop_type, b.quality_score,
            df.predicted_kg AS demand_forecast_kg, df.confidence_pct AS demand_confidence_pct
     FROM listings l
     JOIN batches b ON b.id = l.batch_id
     LEFT JOIN LATERAL (
       SELECT predicted_kg, confidence_pct FROM demand_forecasts
       WHERE crop_type = b.crop_type AND ($1::text IS NULL OR city = $1) AND forecast_date >= CURRENT_DATE
       ORDER BY forecast_date ASC LIMIT 1
     ) df ON TRUE
     WHERE l.status = 'active' AND l.deleted_at IS NULL AND b.deleted_at IS NULL
       AND (l.listing_type = 'OPEN' OR l.listing_type = $2)
     ORDER BY df.predicted_kg DESC NULLS LAST, b.quality_score DESC NULLS LAST
     LIMIT 5`,
    [city ?? null, user.role === 'BULK_BUYER' ? 'BULK_ONLY' : 'CONSUMER_ONLY'],
  );
  return result.rows;
};

module.exports = { createListing, listListings, getListingById, updateListing, updateListingStatus, getRecommended };
