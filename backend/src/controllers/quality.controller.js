const multer = require('multer');
const path = require('path');

const qualityService = require('../services/quality.service');
const { submitTestSchema, uploadCertificateSchema, requestBSampleSchema } = require('../validators/quality.validator');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const MAX_CERT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.env.LOCAL_STORAGE_PATH || './uploads', 'certs')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`),
});

// MIME check happens here (fileFilter), not after the fact -- multer refuses non-PDF uploads
// before they ever touch disk. Size check is enforced by the `limits` option below.
const upload = multer({
  storage,
  limits: { fileSize: MAX_CERT_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('INVALID_MIME_TYPE'));
    }
    return cb(null, true);
  },
}).single('certificate');

// Wraps multer's callback-style middleware so its errors (wrong MIME, too large) become proper
// API error responses instead of multer's own generic Express error page / default 500.
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.message === 'INVALID_MIME_TYPE') {
      return sendError(res, 400, 'INVALID_MIME_TYPE', 'Only PDF files are accepted.');
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 400, 'FILE_TOO_LARGE', 'Certificate PDF must be 5MB or smaller.');
    }
    return next(err);
  });
};

const submitTest = async (req, res, next) => {
  const parsed = submitTestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await qualityService.submitTest(parsed.data.batch_id, req.user, parsed.data);
    logger.info({ action: 'QUALITY_TEST_ROUTE_OK', batchId: parsed.data.batch_id, userId: req.user.id });
    return sendSuccess(res, result, 201, 'Test result recorded.');
  } catch (err) {
    return next(err);
  }
};

const getBatchTests = async (req, res, next) => {
  try {
    const rows = await qualityService.getBatchTests(req.params.batchId);
    return sendSuccess(res, rows);
  } catch (err) {
    return next(err);
  }
};

const uploadCertificate = async (req, res, next) => {
  if (!req.file) {
    return sendError(res, 400, 'FILE_REQUIRED', 'A certificate PDF file is required.');
  }
  const parsed = uploadCertificateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await qualityService.uploadCertificate(parsed.data.batch_id, req.user, req.file, parsed.data);
    return sendSuccess(res, result, 201, 'Certificate uploaded.');
  } catch (err) {
    return next(err);
  }
};

const getBSamples = async (req, res, next) => {
  try {
    const rows = await qualityService.getBSampleRequests(req.params.batchId);
    return sendSuccess(res, rows);
  } catch (err) {
    return next(err);
  }
};

const requestBSample = async (req, res, next) => {
  const parsed = requestBSampleSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await qualityService.requestBSample(req.params.batchId, req.user, parsed.data.selected_lab);
    return sendSuccess(res, result, 200, 'B-sample request submitted.');
  } catch (err) {
    return next(err);
  }
};

module.exports = { submitTest, getBatchTests, uploadMiddleware, uploadCertificate, getBSamples, requestBSample };
