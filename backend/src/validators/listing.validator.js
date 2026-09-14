const { z } = require('zod');

const createListingSchema = z.object({
  batch_id: z.string().uuid(),
  price_per_kg_paise: z.number().int().positive(),
  min_order_kg: z.number().positive().multipleOf(0.5).optional(),
  max_order_kg: z.number().positive().multipleOf(0.5).optional(),
  listing_type: z.enum(['OPEN', 'BULK_ONLY', 'CONSUMER_ONLY']).optional(),
  available_until: z.string().refine((d) => !Number.isNaN(Date.parse(d))).optional(),
});

const updateListingSchema = z.object({
  price_per_kg_paise: z.number().int().positive().optional(),
  min_order_kg: z.number().positive().multipleOf(0.5).optional(),
  max_order_kg: z.number().positive().multipleOf(0.5).optional(),
  available_until: z.string().refine((d) => !Number.isNaN(Date.parse(d))).optional(),
});

const updateStatusSchema = z.object({ status: z.enum(['active', 'paused', 'cancelled']) });

module.exports = { createListingSchema, updateListingSchema, updateStatusSchema };
