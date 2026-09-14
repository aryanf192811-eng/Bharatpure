const { z } = require('zod');

const createBatchSchema = z.object({
  cluster_id: z.string().uuid(),
  contract_id: z.string().uuid().optional(),
  crop_type: z.string().min(1),
  harvest_date: z.string().refine((d) => !Number.isNaN(Date.parse(d)) && new Date(d) <= new Date(), {
    message: 'Harvest date cannot be in the future',
  }),
  total_quantity_kg: z.number().positive().multipleOf(0.5, 'Quantity must be in 0.5kg increments'),
  notes: z.string().optional(),
});

module.exports = { createBatchSchema };
