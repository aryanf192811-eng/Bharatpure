const { z } = require('zod');

const logisticsService = require('../services/logistics.service');
const orderService = require('../services/order.service');
const { completeStopSchema, temperatureLogSchema } = require('../validators/logistics.validator');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const listQuerySchema = z.object({ status: z.string().optional(), date: z.string().optional() });

const dashboard = async (req, res, next) => {
  try {
    const result = await logisticsService.getDashboard(req.user);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

const listRoutes = async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const rows = await logisticsService.listRoutes(req.user, parsed.data);
    return sendSuccess(res, rows);
  } catch (err) {
    return next(err);
  }
};

const getRoute = async (req, res, next) => {
  try {
    const route = await logisticsService.getRouteById(req.params.routeId, req.user);
    return sendSuccess(res, route);
  } catch (err) {
    return next(err);
  }
};

const startRoute = async (req, res, next) => {
  try {
    const result = await logisticsService.startRoute(req.params.routeId, req.user);
    return sendSuccess(res, result, 200, 'Route started.');
  } catch (err) {
    return next(err);
  }
};

const completeStop = async (req, res, next) => {
  const parsed = completeStopSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await logisticsService.completeStop(
      req.params.routeId, req.params.stopId, req.user, parsed.data.notes,
      (orderId, user) => orderService.markDelivered(orderId, user),
    );
    logger.info({ action: 'STOP_COMPLETE_ROUTE_OK', routeId: req.params.routeId, stopId: req.params.stopId });
    return sendSuccess(res, result, 200, 'Stop completed.');
  } catch (err) {
    return next(err);
  }
};

const logTemperature = async (req, res, next) => {
  const parsed = temperatureLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await logisticsService.logTemperature(req.user, parsed.data);
    const message = result.reroute
      ? `Temperature breach detected. Ops team notified and route updated: drop at ${result.reroute.facility_name} (${result.reroute.distance_km}km away).`
      : result.breach_detected
        ? 'Temperature breach detected and logged. Ops team notified.'
        : 'Temperature reading logged.';
    return sendSuccess(res, result, 201, message);
  } catch (err) {
    return next(err);
  }
};

module.exports = { dashboard, listRoutes, getRoute, startRoute, completeStop, logTemperature };
