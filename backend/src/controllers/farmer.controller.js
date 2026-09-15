const { z } = require('zod');

const farmerService = require('../services/farmer.service');
const { sendSuccess, sendError } = require('../utils/response');

const getProfile = async (req, res, next) => {
  try {
    const profile = await farmerService.getProfile(req.user.id);
    return sendSuccess(res, profile);
  } catch (err) {
    return next(err);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await farmerService.getDashboard(req.user.id);
    return sendSuccess(res, dashboard);
  } catch (err) {
    return next(err);
  }
};

const earningsQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

const getEarnings = async (req, res, next) => {
  const parsed = earningsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const earnings = await farmerService.getEarnings(req.user.id, parsed.data);
    return sendSuccess(res, earnings);
  } catch (err) {
    return next(err);
  }
};

const getTrustScore = async (req, res, next) => {
  try {
    const trustScore = await farmerService.getTrustScore(req.user.id);
    return sendSuccess(res, trustScore);
  } catch (err) {
    return next(err);
  }
};

const getCreditEligibility = async (req, res, next) => {
  try {
    const creditEligibility = await farmerService.getCreditEligibility(req.user.id);
    return sendSuccess(res, creditEligibility);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getProfile, getDashboard, getEarnings, getTrustScore, getCreditEligibility };
