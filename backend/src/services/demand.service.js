const { pool } = require('../db');
const logger = require('../utils/logger');
const { callAI } = require('./ai.service');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const CACHE_FRESHNESS_HOURS = 6;
const MODEL_VERSION_LIVE = 'prophet-lgbm-v1'; // per BHARATPURE-AI.md; used only when the AI service actually responds

const getCachedRows = async (cropType, city, days) => {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);
  const result = await pool.query(
    `SELECT crop_type, city, forecast_date, predicted_kg, confidence_pct, range_low_kg, range_high_kg, demand_drivers, model_version, generated_at
     FROM demand_forecasts
     WHERE crop_type = $1 AND city = $2 AND forecast_date >= CURRENT_DATE AND forecast_date <= $3
     ORDER BY forecast_date ASC`,
    [cropType, city, horizon.toISOString().slice(0, 10)],
  );
  return result.rows;
};

const isFresh = (rows) => rows.length > 0 && rows.every((r) => new Date(r.generated_at) > new Date(Date.now() - CACHE_FRESHNESS_HOURS * 60 * 60 * 1000));

/**
 * Cache-first demand forecast: fresh cache (< 6h old) is returned as-is. Otherwise, tries the
 * AI service; on success, upserts the result into the cache and returns it fresh. On any AI
 * failure (including "the service doesn't exist", the current reality of this codebase), falls
 * back to whatever's cached — even if stale — and marks it `stale: true`. Only throws when
 * there is truly nothing cached AND the AI service is unreachable (a genuine cold-start-with-
 * outage edge case).
 */
const getForecast = async (cropType, city, days = 30) => {
  const cached = await getCachedRows(cropType, city, days);
  if (isFresh(cached)) {
    return { data: cached, stale: false };
  }

  const { data: aiData, error } = await callAI('GET', '/demand/forecast', { params: { crop_type: cropType, city, forecast_days: days } });
  if (!error && aiData) {
    // Upsert the AI's response into the cache for next time.
    await pool.query(
      `INSERT INTO demand_forecasts (crop_type, city, forecast_date, predicted_kg, confidence_pct, range_low_kg, range_high_kg, demand_drivers, model_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (crop_type, city, forecast_date, model_version) DO UPDATE SET
         predicted_kg = EXCLUDED.predicted_kg, confidence_pct = EXCLUDED.confidence_pct,
         range_low_kg = EXCLUDED.range_low_kg, range_high_kg = EXCLUDED.range_high_kg,
         demand_drivers = EXCLUDED.demand_drivers, generated_at = NOW()`,
      [
        cropType, city, aiData.forecast_date, aiData.predicted_kg, aiData.confidence_pct,
        aiData.range_low_kg, aiData.range_high_kg, JSON.stringify(aiData.demand_drivers ?? []), MODEL_VERSION_LIVE,
      ],
    );
    const refreshed = await getCachedRows(cropType, city, days);
    return { data: refreshed, stale: false };
  }

  if (cached.length > 0) {
    logger.info({ action: 'DEMAND_FORECAST_SERVED_STALE', cropType, city });
    return { data: cached, stale: true };
  }

  throw apiError(503, 'DEMAND_DATA_UNAVAILABLE', 'No demand forecast available and the AI service is unreachable.');
};

/**
 * Per-city results, isolated from each other -- one city having no cached data and the AI
 * service being unreachable must not take down the whole comparison for cities that DO have
 * data. Each city gets either its forecast or an explicit unavailable marker, never an
 * uncaught throw that aborts the other cities' results too.
 */
const getMultiCity = async (cropType, cities, days = 30) => {
  const results = {};
  for (const city of cities) {
    try {
      // eslint-disable-next-line no-await-in-loop -- small, bounded city list; sequential is fine here
      results[city] = await getForecast(cropType, city, days);
    } catch (err) {
      results[city] = { data: [], stale: true, unavailable: true, reason: err.message };
    }
  }
  return results;
};

/**
 * ADMIN-triggered manual refresh. Unlike getForecast, this always attempts the AI call
 * (ignores cache freshness) since the whole point is "refresh now" -- but still never throws
 * on AI failure, it just reports that the refresh didn't happen.
 */
const refreshForecast = async (cropType, city) => {
  const { data: aiData, error } = await callAI('GET', '/demand/forecast', { params: { crop_type: cropType, city, forecast_days: 30 } });
  if (error || !aiData) {
    return { refreshed: false, reason: 'AI service unavailable' };
  }
  await pool.query(
    `INSERT INTO demand_forecasts (crop_type, city, forecast_date, predicted_kg, confidence_pct, range_low_kg, range_high_kg, demand_drivers, model_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (crop_type, city, forecast_date, model_version) DO UPDATE SET
       predicted_kg = EXCLUDED.predicted_kg, confidence_pct = EXCLUDED.confidence_pct,
       range_low_kg = EXCLUDED.range_low_kg, range_high_kg = EXCLUDED.range_high_kg,
       demand_drivers = EXCLUDED.demand_drivers, generated_at = NOW()`,
    [
      cropType, city, aiData.forecast_date, aiData.predicted_kg, aiData.confidence_pct,
      aiData.range_low_kg, aiData.range_high_kg, JSON.stringify(aiData.demand_drivers ?? []), MODEL_VERSION_LIVE,
    ],
  );
  return { refreshed: true };
};

module.exports = { getForecast, getMultiCity, refreshForecast };
