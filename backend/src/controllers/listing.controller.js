const { z } = require('zod');

const listingService = require('../services/listing.service');
const { createListingSchema, updateListingSchema, updateStatusSchema } = require('../validators/listing.validator');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const logger = require('../utils/logger');

const listQuerySchema = z.object({
  crop_type: z.string().optional(),
  city: z.string().optional(),
  min_quality: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const create = async (req, res, next) => {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await listingService.createListing(req.user, parsed.data);
    logger.info({ action: 'LISTING_CREATE_ROUTE_OK', listingId: result.id, userId: req.user.id });
    return sendSuccess(res, result, 201, 'Listing created.');
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
    const { crop_type: cropType, city, min_quality: minQuality, page, limit } = parsed.data;
    const { rows, total } = await listingService.listListings(req.user, { cropType, city, minQuality, page, limit });
    return sendPaginated(res, rows, page, limit, total);
  } catch (err) {
    return next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const listing = await listingService.getListingById(req.params.listingId);
    return sendSuccess(res, listing);
  } catch (err) {
    return next(err);
  }
};

const update = async (req, res, next) => {
  const parsed = updateListingSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await listingService.updateListing(req.params.listingId, req.user, parsed.data);
    return sendSuccess(res, result, 200, 'Listing updated.');
  } catch (err) {
    return next(err);
  }
};

const updateStatus = async (req, res, next) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await listingService.updateListingStatus(req.params.listingId, req.user, parsed.data.status);
    return sendSuccess(res, result, 200, 'Listing status updated.');
  } catch (err) {
    return next(err);
  }
};

const recommended = async (req, res, next) => {
  try {
    const rows = await listingService.getRecommended(req.user, req.query.city);
    return sendSuccess(res, rows);
  } catch (err) {
    return next(err);
  }
};

module.exports = { create, list, getById, update, updateStatus, recommended };
