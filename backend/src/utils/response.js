// Response wrapper — frozen shapes, per BHARATPURE-API.md. Nothing outside these three shapes.

const sendSuccess = (res, data, statusCode = 200, message) =>
  res.status(statusCode).json({ success: true, data, ...(message && { message }) });

const sendError = (res, statusCode, code, message, details) =>
  res.status(statusCode).json({ success: false, error: { code, message, ...(details && { details }) } });

const sendPaginated = (res, data, page, limit, total) =>
  res.status(200).json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });

module.exports = { sendSuccess, sendError, sendPaginated };
