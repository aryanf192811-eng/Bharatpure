const { z } = require('zod');

const batchService = require('../services/batch.service');
const { createBatchSchema } = require('../validators/batch.validator');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const logger = require('../utils/logger');

const listQuerySchema = z.object({
  status: z.string().optional(),
  crop_type: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const create = async (req, res, next) => {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await batchService.createBatch(req.user, parsed.data);
    logger.info({ action: 'BATCH_CREATE_ROUTE_OK', batchId: result.id, userId: req.user.id });
    return sendSuccess(res, result, 201, 'Batch created.');
  } catch (err) {
    return next(err);
  }
};

const list = async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const { status, crop_type: cropType, page, limit } = parsed.data;
    const { rows, total } = await batchService.listBatches(req.user, { status, cropType, page, limit });
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const batch = await batchService.getBatchById(req.params.batchId, req.user);
    return sendSuccess(res, batch);
  } catch (err) {
    return next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await batchService.deleteBatch(req.params.batchId, req.user);
    logger.info({ action: 'BATCH_DELETE_ROUTE_OK', batchId: req.params.batchId, userId: req.user.id });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};

const clearTemperatureBreach = async (req, res, next) => {
  const parsed = z.object({ review_notes: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await batchService.clearTemperatureBreach(req.params.batchId, req.user, parsed.data.review_notes);
    return sendSuccess(res, result, 200, 'Temperature breach flag cleared.');
  } catch (err) {
    return next(err);
  }
};

module.exports = { create, list, getById, remove, clearTemperatureBreach };
