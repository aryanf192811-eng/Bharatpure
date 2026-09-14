const qrService = require('../services/qr.service');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const scan = async (req, res, next) => {
  try {
    const result = await qrService.scanQr(req.params.qrHash, {
      ip_address: req.ip,
      userId: req.user?.id ?? null,
      userRole: req.user?.role ?? 'PUBLIC',
    });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

const burn = async (req, res, next) => {
  try {
    const result = await qrService.burnQr(req.params.qrHash, req.user);
    logger.info({ action: 'QR_BURN_ROUTE_OK', qrHash: req.params.qrHash, userId: req.user.id });
    return sendSuccess(res, result, 200, 'QR code burned.');
  } catch (err) {
    return next(err);
  }
};

const generate = async (req, res, next) => {
  try {
    const result = await qrService.generateQrImage(req.params.batchId, req.user);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
};

module.exports = { scan, burn, generate };
