const { pool } = require('../db');
const logger = require('../utils/logger');
const { callAI } = require('./ai.service');
const demandService = require('./demand.service');
const priceService = require('./price.service');

/**
 * Local replica of BHARATPURE-AI.md Module 4 (What-If Simulator), used as the fallback when the
 * AI FastAPI service is unreachable (it doesn't exist in this codebase yet). The formula is
 * fully documented there, so this mirrors it rather than degrading to nothing:
 *   simulated_demand = base * (1 + spike%)
 *   simulated_supply = base * (1 - disruption%)   [assumes base_supply ~= base_demand]
 *   shortage_kg = max(0, simulated_demand - simulated_supply)
 *   price_change_pct = diff between a spike-adjusted and a baseline local price recommendation
 *   farmer_realization_change_pct = price_change_pct * 0.7
 *   logistics_cost_change_pct = -8.5 - (spike * 0.1)
 *   recommended_actions: only populated when there's a shortage, same 3 action types and
 *   example values as the documented Python version (SOURCE_ALTERNATE_FPO at a hardcoded 120km,
 *   ADJUST_PRICE_CEILING at 1.5% of the baseline low price, REROUTE_VEHICLE +1 stop).
 */
const computeLocalSimulation = async (cropType, city, demandSpikePct, supplyDisruptionPct) => {
  const forecastResult = await demandService.getForecast(cropType, city, 30).catch(() => null);
  const baseDemandKg = forecastResult?.data?.[0]?.predicted_kg ? Number(forecastResult.data[0].predicted_kg) : 500; // documented fallback when even the cache is empty

  const simulatedDemandKg = baseDemandKg * (1 + demandSpikePct / 100);
  const simulatedSupplyKg = baseDemandKg * (1 - supplyDisruptionPct / 100);
  const shortageKg = Math.max(0, simulatedDemandKg - simulatedSupplyKg);

  const baseline = priceService.computeLocalRecommendation(cropType, 90, 0);
  const spiked = priceService.computeLocalRecommendation(cropType, 90, demandSpikePct);
  const priceChangePct = baseline && spiked
    ? (((spiked.recommended_low_paise + spiked.recommended_high_paise) / 2 - (baseline.recommended_low_paise + baseline.recommended_high_paise) / 2)
       / ((baseline.recommended_low_paise + baseline.recommended_high_paise) / 2)) * 100
    : 0;

  const recommendedActions = [];
  if (shortageKg > 0) {
    recommendedActions.push({
      action: 'SOURCE_ALTERNATE_FPO',
      description: `Source from an alternate FPO cluster (~120 km away, ~${Math.round(shortageKg * 1.2)} kg available)`,
    });
    if (baseline) {
      recommendedActions.push({
        action: 'ADJUST_PRICE_CEILING',
        description: `Raise the price ceiling by ~₹${(baseline.recommended_low_paise * 0.015 / 100).toFixed(2)}/kg`,
        adjustment_paise: Math.round(baseline.recommended_low_paise * 0.015),
      });
    }
    recommendedActions.push({ action: 'REROUTE_VEHICLE', description: 'Add one additional pickup stop to the nearest active route' });
  }

  return {
    shortage_kg: Math.round(shortageKg),
    surplus_kg: Math.round(Math.max(0, simulatedSupplyKg - simulatedDemandKg)),
    price_change_pct: Number(priceChangePct.toFixed(2)),
    farmer_realization_change_pct: Number((priceChangePct * 0.7).toFixed(2)),
    logistics_cost_change_pct: Number((-8.5 - demandSpikePct * 0.1).toFixed(2)),
    recommended_actions: recommendedActions,
    model_version: 'node-fallback-v1',
    data_source: 'local_fallback_formula',
  };
};

const runSimulation = async (user, params) => {
  const start = Date.now();
  const { crop_type: cropType, city, demand_spike_pct: demandSpikePct, supply_disruption_pct: supplyDisruptionPct } = params;

  const { data: aiData, error } = await callAI('POST', '/simulation/run', { data: params });
  const output = !error && aiData ? { ...aiData, stale: false } : { ...(await computeLocalSimulation(cropType, city, demandSpikePct, supplyDisruptionPct)), stale: true };

  const runDurationMs = Date.now() - start;
  const result = await pool.query(
    `INSERT INTO simulation_runs (run_by, input_params, output_results, run_duration_ms) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
    [user.id, JSON.stringify(params), JSON.stringify(output), runDurationMs],
  );

  logger.info({ action: 'SIMULATION_RUN', simulationId: result.rows[0].id, stale: output.stale });
  return { id: result.rows[0].id, ...params, ...output, run_duration_ms: runDurationMs, created_at: result.rows[0].created_at };
};

const getHistory = async (page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const countResult = await pool.query(`SELECT COUNT(*) FROM simulation_runs`);
  const dataResult = await pool.query(
    `SELECT id, run_by, input_params, output_results, run_duration_ms, created_at
     FROM simulation_runs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

module.exports = { runSimulation, getHistory };
