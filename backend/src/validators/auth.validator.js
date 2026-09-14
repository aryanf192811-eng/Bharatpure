const { z } = require('zod');

// Shared primitive rules per BHARATPURE-API.md conventions.
const phone = z.string().regex(/^[6-9]\d{9}$/, 'Phone must be a 10-digit Indian mobile number');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');
const pincode = z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid Indian pincode');
const gstin = z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GSTIN format');

const baseFields = {
  phone,
  password,
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email().optional(),
};

const farmerSchema = z.object({
  ...baseFields,
  role: z.literal('FARMER'),
  fpo_name: z.string().min(1),
  registration_number: z.string().min(1),
  state: z.string().min(1),
  district: z.string().min(1),
  primary_crop_types: z.array(z.string().min(1)).min(1, 'At least one crop type is required'),
});

const consumerSchema = z.object({
  ...baseFields,
  role: z.literal('CONSUMER'),
  delivery_pincode: pincode,
});

const bulkBuyerSchema = z.object({
  ...baseFields,
  email: z.string().email('Email is required for BULK_BUYER'), // required, not optional, for this role
  role: z.literal('BULK_BUYER'),
  company_name: z.string().min(1),
  gstin,
  business_type: z.enum(['restaurant_chain', 'food_processor', 'institution', 'other']),
});

const logisticsSchema = z.object({
  ...baseFields,
  role: z.literal('LOGISTICS'),
  vehicle_type: z.enum(['DRY_VAN', 'COLD_VAN']),
  vehicle_registration_number: z.string().min(1),
  base_state: z.string().optional(),
  base_city: z.string().optional(),
});

const adminSchema = z.object({
  ...baseFields,
  email: z.string().email('Email is required for ADMIN'), // required, not optional, for this role
  role: z.literal('ADMIN'),
  admin_code: z.string().min(1),
});

const registerSchema = z.discriminatedUnion('role', [
  farmerSchema,
  consumerSchema,
  bulkBuyerSchema,
  logisticsSchema,
  adminSchema,
]);

module.exports = { registerSchema };
