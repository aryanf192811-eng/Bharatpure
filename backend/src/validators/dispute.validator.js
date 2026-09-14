const { z } = require('zod');

const createDisputeSchema = z.object({
  order_id: z.string().uuid(),
  reason_category: z.enum(['QUALITY_MISMATCH', 'QUANTITY_SHORT', 'TEMPERATURE_BREACH', 'WRONG_PRODUCT', 'NOT_DELIVERED', 'OTHER']),
  description: z.string().min(1),
});

const addEvidenceSchema = z.object({
  evidence_type: z.enum(['BIR_EVENT', 'PHOTO', 'DOCUMENT', 'BIR_SNAPSHOT']),
  bir_event_id: z.string().uuid().optional(),
  file_url: z.string().optional(),
  description: z.string().optional(),
});

const resolveDisputeSchema = z.object({
  resolution: z.string().min(1),
  refund_amount_paise: z.number().int().min(0).default(0),
  outcome: z.enum(['resolved', 'dismissed']),
});

module.exports = { createDisputeSchema, addEvidenceSchema, resolveDisputeSchema };
