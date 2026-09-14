const { z } = require('zod');

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().min(1),
});

const releaseEscrowSchema = z.object({ reason: z.string().min(1) });

const optimizeRoutesSchema = z.object({
  order_ids: z.array(z.string().uuid()).min(1),
  vehicle_type: z.enum(['DRY_VAN', 'COLD_VAN', 'MOTORCYCLE']),
  depot_lat: z.number(),
  depot_lng: z.number(),
});

module.exports = { updateUserStatusSchema, releaseEscrowSchema, optimizeRoutesSchema };
