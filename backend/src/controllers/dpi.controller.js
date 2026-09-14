const { z } = require('zod');

const dpiService = require('../services/dpi.service');
const { sendSuccess, sendError } = require('../utils/response');

const agristackFarmer = (req, res) => sendSuccess(res, dpiService.getAgristackFarmer(req.params.farmerId));

const enamPrices = async (req, res, next) => {
  const parsed = z.object({ crop_type: z.string().min(1), days: z.coerce.number().int().positive().max(30).default(30) }).safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    return sendSuccess(res, dpiService.getEnamPrices(parsed.data.crop_type, parsed.data.days));
  } catch (err) {
    return next(err);
  }
};

const ondcListings = async (req, res, next) => {
  try {
    const result = await dpiService.getOndcListings();
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

module.exports = { agristackFarmer, enamPrices, ondcListings };
