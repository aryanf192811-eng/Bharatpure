const { z } = require('zod');

const demandService = require('../services/demand.service');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const forecastQuerySchema = z.object({
  crop_type: z.string().min(1),
  city: z.string().min(1),
  days: z.coerce.number().int().positive().max(365).default(30),
});
const multiCityQuerySchema = z.object({
  crop_type: z.string().min(1),
  cities: z.string().min(1), // comma-separated
  days: z.coerce.number().int().positive().max(365).default(30),
});
const refreshBodySchema = z.object({ crop_type: z.string().min(1), city: z.string().min(1) });

const forecast = async (req, res, next) => {
  const parsed = forecastQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const { crop_type: cropType, city, days } = parsed.data;
    const result = await demandService.getForecast(cropType, city, days);
    // `stale` has to live inside `data` -- the frozen response wrapper only has
    // success/data/message, there's no room for a sibling top-level field.
    return sendSuccess(res, { forecast: result.data, stale: result.stale });
  } catch (err) {
    return next(err);
  }
};

const multiCity = async (req, res, next) => {
  const parsed = multiCityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const { crop_type: cropType, cities, days } = parsed.data;
    const result = await demandService.getMultiCity(cropType, cities.split(',').map((c) => c.trim()), days);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

const refresh = async (req, res, next) => {
  const parsed = refreshBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await demandService.refreshForecast(parsed.data.crop_type, parsed.data.city);
    logger.info({ action: 'DEMAND_REFRESH_ROUTE_OK', ...parsed.data, ...result });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

module.exports = { forecast, multiCity, refresh };
