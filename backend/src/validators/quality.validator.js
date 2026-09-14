const { z } = require('zod');

const submitTestSchema = z.object({
  batch_id: z.string().uuid(),
  tier: z.enum(['TIER1', 'TIER2']),
  result: z.enum(['PASS', 'FAIL']),
  purity_score: z.number().min(0).max(100).optional(),
  test_parameters: z.record(z.string(), z.unknown()).optional(),
  lab_name: z.string().optional(),
  lab_accreditation: z.string().optional(),
  rejection_reason: z.string().optional(),
});

const uploadCertificateSchema = z.object({
  batch_id: z.string().uuid(),
  cert_number: z.string().min(1),
  issued_at: z.string().refine((d) => !Number.isNaN(Date.parse(d))),
  expires_at: z.string().refine((d) => !Number.isNaN(Date.parse(d))).optional(),
});

const requestBSampleSchema = z.object({ selected_lab: z.string().min(1) });

module.exports = { submitTestSchema, uploadCertificateSchema, requestBSampleSchema };
