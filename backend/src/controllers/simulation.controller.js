const { z } = require('zod');

const simulationService = require('../services/simulation.service');
const { runSimulationSchema } = require('../validators/simulation.validator');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const logger = require('../utils/logger');

const historyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const run = async (req, res, next) => {
  const parsed = runSimulationSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await simulationService.runSimulation(req.user, parsed.data);
    logger.info({ action: 'SIMULATION_RUN_ROUTE_OK', simulationId: result.id, userId: req.user.id });
    return sendSuccess(res, result, 201);
  } catch (err) {
    return next(err);
  }
};

const history = async (req, res, next) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const { page, limit } = parsed.data;
    const { rows, total } = await simulationService.getHistory(page, limit);
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

module.exports = { run, history };
