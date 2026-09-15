import { z } from 'zod'

// Mirrors backend/src/validators/auth.validator.js exactly -- kept in sync by hand since the two
// runtimes don't share a schema instance. Any change there must be reflected here.
export const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/[0-9]/, 'Must contain a number')
const pincodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid Indian pincode')
const gstinSchema = z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GSTIN format')

const baseFields = {
  phone: phoneSchema,
  password: passwordSchema,
  full_name: z.string().min(1, 'Full name is required'),
}

export const farmerRegisterSchema = z.object({
  ...baseFields,
  role: z.literal('FARMER'),
  email: z.string().email().optional().or(z.literal('')),
  fpo_name: z.string().min(1, 'FPO name is required'),
  registration_number: z.string().min(1, 'Registration number is required'),
  state: z.string().min(1, 'State is required'),
  district: z.string().min(1, 'District is required'),
  primary_crop_types: z.array(z.string().min(1)).min(1, 'Select a primary crop'),
})

export const consumerRegisterSchema = z.object({
  ...baseFields,
  role: z.literal('CONSUMER'),
  email: z.string().email().optional().or(z.literal('')),
  delivery_pincode: pincodeSchema,
})

export const bulkBuyerRegisterSchema = z.object({
  ...baseFields,
  role: z.literal('BULK_BUYER'),
  email: z.string().email('Email is required for Bulk Buyer'),
  company_name: z.string().min(1, 'Company name is required'),
  gstin: gstinSchema,
  business_type: z.enum(['restaurant_chain', 'food_processor', 'institution', 'other']),
})

export const logisticsRegisterSchema = z.object({
  ...baseFields,
  role: z.literal('LOGISTICS'),
  email: z.string().email().optional().or(z.literal('')),
  vehicle_type: z.enum(['DRY_VAN', 'COLD_VAN']),
  vehicle_registration_number: z.string().min(1, 'Vehicle registration number is required'),
  base_state: z.string().optional(),
  base_city: z.string().optional(),
})

export const adminRegisterSchema = z.object({
  ...baseFields,
  role: z.literal('ADMIN'),
  email: z.string().email('Email is required for Admin'),
  admin_code: z.string().min(1, 'Admin registration code is required'),
  designation: z.string().optional(),
})
