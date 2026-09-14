const { z } = require('zod');

const priceService = require('../services/price.service');
const { sendSuccess, sendError } = require('../utils/response');

const recommendationQuerySchema = z.object({
  crop_type: z.string().min(1),
  quality_score: z.coerce.number().min(0).max(100),
  city: z.string().min(1).optional(),
});
const marketRatesQuerySchema = z.object({ crop_type: z.string().min(1) });
const premiumCalcQuerySchema = z.object({
  quality_score: z.coerce.number().min(0).max(100),
  crop_type: z.string().min(1),
  quantity_kg: z.coerce.number().positive(),
  destination_city: z.string().min(1).optional(),
});

const recommendation = async (req, res, next) => {
  const parsed = recommendationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const { crop_type: cropType, quality_score: qualityScore, city } = parsed.data;
    const result = await priceService.getRecommendation(cropType, qualityScore, city);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

const marketRates = async (req, res, next) => {
  const parsed = marketRatesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const result = priceService.getMarketRates(parsed.data.crop_type);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

const premiumCalculator = async (req, res, next) => {
  const parsed = premiumCalcQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const { quality_score: qualityScore, crop_type: cropType, quantity_kg: quantityKg, destination_city: city } = parsed.data;
    const result = await priceService.getPremiumCalculator(qualityScore, cropType, quantityKg, city);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

module.exports = { recommendation, marketRates, premiumCalculator };
