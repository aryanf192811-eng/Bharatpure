const { z } = require('zod');

const orderService = require('../services/order.service');
const { createOrderSchema } = require('../validators/order.validator');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const logger = require('../utils/logger');

const listQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
const cancelSchema = z.object({ reason: z.string().optional() });

const create = async (req, res, next) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await orderService.createOrder(req.user, parsed.data);
    logger.info({ action: 'ORDER_CREATE_ROUTE_OK', orderId: result.id, userId: req.user.id });
    return sendSuccess(res, result, 201, 'Order placed.');
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
    const { rows, total } = await orderService.listOrders(req.user, { status, page, limit });
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.orderId, req.user);
    return sendSuccess(res, order);
  } catch (err) {
    return next(err);
  }
};

const cancel = async (req, res, next) => {
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await orderService.cancelOrder(req.params.orderId, req.user, parsed.data.reason);
    return sendSuccess(res, result, 200, 'Order cancelled.');
  } catch (err) {
    return next(err);
  }
};

const markDelivered = async (req, res, next) => {
  try {
    const result = await orderService.markDelivered(req.params.orderId, req.user);
    logger.info({ action: 'ORDER_DELIVERED_ROUTE_OK', orderId: req.params.orderId, userId: req.user.id });
    return sendSuccess(res, result, 200, 'Order marked delivered.');
  } catch (err) {
    return next(err);
  }
};

module.exports = { create, list, getById, cancel, markDelivered };
