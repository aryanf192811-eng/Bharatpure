const { z } = require('zod');

const clusterService = require('../services/cluster.service');
const { sendSuccess, sendError } = require('../utils/response');

const list = async (req, res, next) => {
  const parsed = z.object({ state: z.string().optional(), crop_type: z.string().optional() }).safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const rows = await clusterService.listClusters({ state: parsed.data.state, cropType: parsed.data.crop_type });
    return sendSuccess(res, rows);
  } catch (err) {
    return next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const cluster = await clusterService.getClusterById(req.params.clusterId);
    return sendSuccess(res, cluster);
  } catch (err) {
    return next(err);
  }
};

module.exports = { list, getById };
