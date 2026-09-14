const { z } = require('zod');

const adminService = require('../services/admin.service');
const { updateUserStatusSchema, releaseEscrowSchema, optimizeRoutesSchema } = require('../validators/admin.validator');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const logger = require('../utils/logger');

const paginationSchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20) });

const dashboard = async (req, res, next) => {
  try {
    const result = await adminService.getDashboard();
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

const batches = async (req, res, next) => {
  const parsed = paginationSchema.extend({ status: z.string().optional(), fpo_id: z.string().uuid().optional() }).safeParse(req.query);
  if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  try {
    const { status, fpo_id: fpoId, page, limit } = parsed.data;
    const { rows, total } = await adminService.listBatches({ status, fpoId, page, limit });
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

const users = async (req, res, next) => {
  const parsed = paginationSchema.extend({ role: z.string().optional(), status: z.string().optional() }).safeParse(req.query);
  if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  try {
    const { role, status, page, limit } = parsed.data;
    const { rows, total } = await adminService.listUsers({ role, status, page, limit });
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

const updateUserStatus = async (req, res, next) => {
  const parsed = updateUserStatusSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  try {
    const result = await adminService.updateUserStatus(req.params.userId, req.user, parsed.data.status, parsed.data.reason);
    return sendSuccess(res, result, 200, 'User status updated.');
  } catch (err) {
    return next(err);
  }
};

const escrow = async (req, res, next) => {
  const parsed = paginationSchema.extend({ status: z.string().optional() }).safeParse(req.query);
  if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  try {
    const { status, page, limit } = parsed.data;
    const { rows, total } = await adminService.listEscrow({ status, page, limit });
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

const releaseEscrow = async (req, res, next) => {
  const parsed = releaseEscrowSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  try {
    const result = await adminService.releaseEscrow(req.params.escrowId, req.user, parsed.data.reason);
    logger.info({ action: 'ESCROW_RELEASE_ROUTE_OK', escrowId: req.params.escrowId, adminId: req.user.id });
    return sendSuccess(res, result, 200, 'Escrow released.');
  } catch (err) {
    return next(err);
  }
};

const iei = async (req, res, next) => {
  const parsed = z.object({ from: z.string().optional(), to: z.string().optional(), crop_type: z.string().optional() }).safeParse(req.query);
  if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  try {
    const { from, to, crop_type: cropType } = parsed.data;
    const result = await adminService.getIei({ from, to, cropType });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

const auditLogs = async (req, res, next) => {
  const parsed = paginationSchema.extend({ entity_type: z.string().optional(), entity_id: z.string().optional() }).safeParse(req.query);
  if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  try {
    const { entity_type: entityType, entity_id: entityId, page, limit } = parsed.data;
    const { rows, total } = await adminService.listAuditLogs({ entityType, entityId, page, limit });
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

const optimizeRoutes = async (req, res, next) => {
  const parsed = optimizeRoutesSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  try {
    const result = await adminService.optimizeRoutes(req.user, parsed.data);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return next(err);
  }
};

module.exports = { dashboard, batches, users, updateUserStatus, escrow, releaseEscrow, iei, auditLogs, optimizeRoutes };
