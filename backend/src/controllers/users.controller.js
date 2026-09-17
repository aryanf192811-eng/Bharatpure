const { z } = require('zod');

const notificationService = require('../services/notification.service');
const userService = require('../services/user.service');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const listQuerySchema = z.object({
  unread_only: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const me = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.id);
    return sendSuccess(res, profile);
  } catch (err) {
    return next(err);
  }
};

const listNotifications = async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query params', parsed.error.issues);
  }
  try {
    const { unread_only: unreadOnly, page, limit } = parsed.data;
    const { rows, total } = await notificationService.listForUser(req.user.id, { unreadOnly, page, limit });
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const result = await notificationService.markRead(req.params.notificationId, req.user.id);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

module.exports = { me, listNotifications, markNotificationRead };
