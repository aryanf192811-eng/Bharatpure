const { pool } = require('../db');
const logger = require('../utils/logger');
const demandService = require('../services/demand.service');
const { computeDemandDeltaPct } = require('../utils/demandSignal');

// clusters.state doesn't line up with demand_forecasts.city (a forecast is per-city, a cluster
// is per-state/district), so each cluster's state maps to its nearest demand-forecast city --
// the same "pick a representative city, don't invent new geodata" simplification whatsapp.service.js's
// CITIES list already relies on. Extend this map as more cluster states get seeded.
const STATE_TO_CITY = {
  Maharashtra: 'Mumbai',
  Gujarat: 'Ahmedabad',
  Karnataka: 'Bangalore',
  'West Bengal': 'Kolkata',
  'Tamil Nadu': 'Chennai',
  Rajasthan: 'Delhi',
  'Himachal Pradesh': 'Delhi',
};
const DEFAULT_CITY = 'Delhi';

const INCREASE_THRESHOLD_PCT = 15;
const DECREASE_THRESHOLD_PCT = -15;

/**
 * Closes the loop from demand forecasting back to what farmers actually plant next season: for
 * every cluster (one crop per cluster), pulls the demand forecast for that crop in the cluster's
 * nearest city, classifies INCREASE/MAINTAIN/DECREASE off the same delta-vs-expected-range math
 * farmer.service.js's dashboard already uses, persists one crop_advisories row, and notifies
 * every FPO with batches in that cluster.
 *
 * Recipient resolution deliberately does NOT use cluster_farmers (the M2M table BHARATPURE-DB.md
 * documents for "which farmers belong to which cluster") -- in this codebase's actual seed data
 * and registration model, a FARMER-role account IS the FPO operator (see seed.js's comment on
 * TASK-007's registration model), and neither cluster_farmers nor farmer_profiles is ever
 * populated. The real, populated link from a cluster to the account that should hear about it is
 * via batches (which carry both cluster_id and fpo_id) -> fpo_profiles.user_id.
 */
const runCropAdvisoryJob = async () => {
  const start = Date.now();
  const client = await pool.connect();
  try {
    const clustersResult = await client.query(`SELECT id, name, crop_type, state FROM clusters`);

    let advisoriesComputed = 0;
    let notificationsSent = 0;
    for (const cluster of clustersResult.rows) {
      const city = STATE_TO_CITY[cluster.state] ?? DEFAULT_CITY;
      let point;
      try {
        // eslint-disable-next-line no-await-in-loop -- small, bounded cluster count; sequential keeps each cluster's failure isolated
        const forecast = await demandService.getForecast(cluster.crop_type, city, 30);
        [point] = forecast.data;
      } catch (err) {
        logger.error({ action: 'CROP_ADVISORY_FORECAST_FAILED', clusterId: cluster.id, cropType: cluster.crop_type, err: err.message });
        continue; // eslint-disable-line no-continue -- one cluster's forecast failure must not abort the rest
      }
      if (!point) continue; // eslint-disable-line no-continue -- no forecast row available for this crop/city yet

      const demandDeltaPct = computeDemandDeltaPct(point.predicted_kg, point.range_low_kg, point.range_high_kg);
      const recommendation = demandDeltaPct > INCREASE_THRESHOLD_PCT ? 'INCREASE' : demandDeltaPct < DECREASE_THRESHOLD_PCT ? 'DECREASE' : 'MAINTAIN';
      const rationale = `${cluster.crop_type} demand in ${city} is forecast ${demandDeltaPct > 0 ? '+' : ''}${demandDeltaPct}% vs the expected range (${point.confidence_pct}% confidence).`;

      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO crop_advisories (cluster_id, crop_type, demand_delta_pct, recommendation, rationale) VALUES ($1,$2,$3,$4,$5)`,
        [cluster.id, cluster.crop_type, demandDeltaPct, recommendation, rationale],
      );
      advisoriesComputed += 1;

      // eslint-disable-next-line no-await-in-loop
      const recipientsResult = await client.query(
        `SELECT DISTINCT fp.user_id
         FROM batches b JOIN fpo_profiles fp ON fp.id = b.fpo_id
         WHERE b.cluster_id = $1`,
        [cluster.id],
      );
      const title = recommendation === 'INCREASE' ? `Grow more ${cluster.crop_type} next season`
        : recommendation === 'DECREASE' ? `Consider less ${cluster.crop_type} next season`
        : `${cluster.crop_type} demand steady for next season`;
      for (const recipient of recipientsResult.rows) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO notifications (user_id, type, title, body, metadata) VALUES ($1,'CROP_ADVISORY',$2,$3,$4)`,
          [
            recipient.user_id, title, rationale,
            JSON.stringify({ cluster_id: cluster.id, crop_type: cluster.crop_type, recommendation, demand_delta_pct: demandDeltaPct }),
          ],
        );
        notificationsSent += 1;
      }
    }

    const durationMs = Date.now() - start;
    logger.info({ action: 'CROP_ADVISORY_JOB_COMPLETE', advisoriesComputed, notificationsSent, durationMs });
    return { advisories_computed: advisoriesComputed, notifications_sent: notificationsSent, duration_ms: durationMs };
  } catch (err) {
    logger.error({ action: 'CROP_ADVISORY_JOB_FAILED', err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { runCropAdvisoryJob };
