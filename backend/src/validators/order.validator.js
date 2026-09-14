const { z } = require('zod');

const createOrderSchema = z.object({
  items: z.array(z.object({
    listing_id: z.string().uuid(),
    quantity_kg: z.number().positive().multipleOf(0.5),
  })).min(1),
  delivery_address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  delivery_notes: z.string().optional(),
  payment_reference: z.string().optional(),
});

module.exports = { createOrderSchema };
