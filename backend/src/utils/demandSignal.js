/**
 * Shared "how far off expected is this forecast" calculation, extracted so it isn't duplicated
 * a third time (farmer.service.js's getDemandSignals had it inline first; crop-advisory.job.js
 * needs the identical math). delta_pct is derived (not a stored column): predicted_kg vs the
 * midpoint of [range_low_kg, range_high_kg] -- demand_forecasts has no historical-baseline
 * column to diff against, so the forecast's own range midpoint stands in for "expected."
 */
const computeDemandDeltaPct = (predictedKg, rangeLowKg, rangeHighKg) => {
  const midpoint = (Number(rangeLowKg) + Number(rangeHighKg)) / 2;
  return midpoint > 0 ? Math.round(((Number(predictedKg) - midpoint) / midpoint) * 1000) / 10 : 0;
};

module.exports = { computeDemandDeltaPct };
