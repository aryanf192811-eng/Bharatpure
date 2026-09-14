const { z } = require('zod');

const disputeService = require('../services/dispute.service');
const { createDisputeSchema, addEvidenceSchema, resolveDisputeSchema } = require('../validators/dispute.validator');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const logger = require('../utils/logger');

const listQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const create = async (req, res, next) => {
  const parsed = createDisputeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await disputeService.createDispute(req.user, parsed.data);
    logger.info({ action: 'DISPUTE_CREATE_ROUTE_OK', disputeId: result.id, userId: req.user.id });
    return sendSuccess(res, result, 201, 'Dispute raised.');
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
    const { status, page, limit } = parsed.data;
    const { rows, total } = await disputeService.listDisputes(req.user, { status, page, limit });
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const dispute = await disputeService.getDisputeById(req.params.disputeId, req.user);
    return sendSuccess(res, dispute);
  } catch (err) {
    return next(err);
  }
};

const addEvidence = async (req, res, next) => {
  const parsed = addEvidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await disputeService.addEvidence(req.params.disputeId, req.user, parsed.data);
    return sendSuccess(res, result, 201, 'Evidence submitted.');
  } catch (err) {
    return next(err);
  }
};

const resolve = async (req, res, next) => {
  const parsed = resolveDisputeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await disputeService.resolveDispute(req.params.disputeId, req.user, parsed.data);
    return sendSuccess(res, result, 200, 'Dispute resolved.');
  } catch (err) {
    return next(err);
  }
};

module.exports = { create, list, getById, addEvidence, resolve };
