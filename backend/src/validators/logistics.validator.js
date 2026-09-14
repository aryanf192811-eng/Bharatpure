const { z } = require('zod');

const completeStopSchema = z.object({ notes: z.string().optional() });

const temperatureLogSchema = z.object({
  batch_id: z.string().uuid(),
  route_id: z.string().uuid().optional(),
  temperature_c: z.number(),
  threshold_c: z.number(),
  vehicle_id: z.string().optional(),
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
});

module.exports = { completeStopSchema, temperatureLogSchema };
