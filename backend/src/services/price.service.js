const fs = require('fs');

const logger = require('../utils/logger');
const { callAI } = require('./ai.service');

let enamCache = null;
const loadEnamMock = () => {
  if (!enamCache) {
    enamCache = JSON.parse(fs.readFileSync(process.env.ENAM_MOCK_DATA_PATH, 'utf-8'));
  }
  return enamCache;
};

const getCommodityPricePaise = (cropType) => {
  const mock = loadEnamMock();
  const crop = mock.crops[cropType];
  if (!crop) return null;
  return crop.history[crop.history.length - 1].price_paise_per_kg; // most recent day
};

// Per BHARATPURE-AI.md's documented price model (Module 2). Replicated here in Node as the
// fallback computation when the AI service is unreachable, since (unlike demand forecasting,
// which genuinely needs the trained model) this formula is simple and fully documented — no
// reason to degrade to "no price at all" when the math is right here.
const QUALITY_BANDS = {
  PREMIUM: { min: 90, multiplier: 1.32, demandBoost: 0.04 },
  STANDARD: { min: 70, multiplier: 1.12, demandBoost: 0.02 },
  ECONOMY: { min: 0, multiplier: 0.95, demandBoost: 0.01 },
};

const qualityBand = (qualityScore) => {
  if (qualityScore >= QUALITY_BANDS.PREMIUM.min) return 'PREMIUM';
  if (qualityScore >= QUALITY_BANDS.STANDARD.min) return 'STANDARD';
  return 'ECONOMY';
};

const buyerAcceptanceProb = (premiumPct) => 100 / (1 + Math.exp(0.08 * (premiumPct - 35)));

const computeLocalRecommendation = (cropType, qualityScore, demandDeltaPct = 0) => {
  const commodityPricePaise = getCommodityPricePaise(cropType);
  if (commodityPricePaise === null) return null;

  const band = qualityBand(qualityScore);
  const { multiplier, demandBoost } = QUALITY_BANDS[band];
  const demandFactor = 1 + (demandDeltaPct / 10) * demandBoost;
  const midPricePaise = commodityPricePaise * multiplier * demandFactor;
  const lowPaise = Math.round(midPricePaise * 0.95);
  const highPaise = Math.round(midPricePaise * 1.05);
  const premiumPct = ((midPricePaise - commodityPricePaise) / commodityPricePaise) * 100;

  return {
    crop_type: cropType,
    quality_score_band: band,
    commodity_price_paise: commodityPricePaise,
    recommended_low_paise: lowPaise,
    recommended_high_paise: highPaise,
    premium_pct: Number(premiumPct.toFixed(1)),
    buyer_acceptance_prob: Number(buyerAcceptanceProb(premiumPct).toFixed(1)),
    model_version: 'node-fallback-v1',
    data_source: 'local_fallback_formula',
  };
};

/**
 * Tries the AI service first (its computation is the authoritative one — it can factor in
 * live demand signals this fallback can't see); on any failure, falls back to the local
 * formula above rather than returning an error, matching this project's standing rule that an
 * AI outage must never surface as a failure to the end user.
 */
const getRecommendation = async (cropType, qualityScore, city) => {
  const { data, error } = await callAI('GET', '/price/recommendation', { params: { crop_type: cropType, quality_score: qualityScore, city } });
  if (!error && data) {
    return { ...data, stale: false };
  }
  const local = computeLocalRecommendation(cropType, qualityScore);
  if (!local) {
    const err = new Error(`No commodity price data available for crop type "${cropType}".`);
    err.statusCode = 404;
    err.code = 'COMMODITY_PRICE_NOT_FOUND';
    throw err;
  }
  logger.info({ action: 'PRICE_RECOMMENDATION_LOCAL_FALLBACK', cropType });
  return { ...local, stale: true };
};

const getMarketRates = (cropType) => {
  const mock = loadEnamMock();
  const crop = mock.crops[cropType];
  if (!crop) {
    const err = new Error(`No market rate data available for crop type "${cropType}".`);
    err.statusCode = 404;
    err.code = 'COMMODITY_PRICE_NOT_FOUND';
    throw err;
  }
  return { crop_type: cropType, history: crop.history, data_source: mock.data_source };
};

const getPremiumCalculator = async (qualityScore, cropType, quantityKg, city) => {
  const recommendation = await getRecommendation(cropType, qualityScore, city);
  const midPricePaise = Math.round((recommendation.recommended_low_paise + recommendation.recommended_high_paise) / 2);
  const commodityRealizationPaise = Math.round(recommendation.commodity_price_paise * quantityKg);
  const bharatpureRealizationPaise = Math.round(midPricePaise * quantityKg);

  return {
    ...recommendation,
    quantity_kg: quantityKg,
    commodity_realization_paise: commodityRealizationPaise,
    bharatpure_realization_paise: bharatpureRealizationPaise,
    realization_uplift_paise: bharatpureRealizationPaise - commodityRealizationPaise,
  };
};

module.exports = { getRecommendation, getMarketRates, getPremiumCalculator };
