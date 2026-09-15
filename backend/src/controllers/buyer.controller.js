const buyerService = require('../services/buyer.service');
const { sendSuccess } = require('../utils/response');

const getProfile = async (req, res, next) => {
  try {
    const profile = await buyerService.getProfile(req.user.id);
    return sendSuccess(res, profile);
  } catch (err) {
    return next(err);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await buyerService.getDashboard(req.user.id);
    return sendSuccess(res, dashboard);
  } catch (err) {
    return next(err);
  }
};

const getReliability = async (req, res, next) => {
  try {
    const reliability = await buyerService.getReliability(req.user.id);
    return sendSuccess(res, reliability);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getProfile, getDashboard, getReliability };
