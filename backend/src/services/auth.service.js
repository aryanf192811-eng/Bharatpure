const bcrypt = require('bcrypt');
const crypto = require('crypto');

const { pool } = require('../db');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;

// Maps a Postgres unique_violation's constraint name to the API error it should surface as.
// Every UNIQUE constraint touched by registration needs an entry here, or a duplicate-value
// error falls through to a generic 500 instead of a proper 409.
const UNIQUE_VIOLATION_MAP = {
  users_phone_key: { statusCode: 409, code: 'PHONE_ALREADY_EXISTS', message: 'This phone number is already registered.' },
  users_email_key: { statusCode: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'This email is already registered.' },
  fpo_profiles_registration_number_key: {
    statusCode: 409,
    code: 'REGISTRATION_NUMBER_TAKEN',
    message: 'This FPO registration number is already in use.',
  },
  bulk_buyer_profiles_gstin_key: { statusCode: 409, code: 'GSTIN_ALREADY_EXISTS', message: 'This GSTIN is already registered.' },
  logistics_profiles_vehicle_registration_number_key: {
    statusCode: 409,
    code: 'VEHICLE_ALREADY_REGISTERED',
    message: 'This vehicle registration number is already in use.',
  },
};

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

/**
 * Registers a new user. All writes (users row + role-specific profile row) happen in one
 * transaction — a failure partway through must never leave an orphaned user with no profile,
 * or vice versa.
 *
 * @param {object} data - already validated against auth.validator.js's registerSchema
 * @returns {{ userId: string, devOtp: string }} devOtp is the raw OTP, never the hash
 */
const register = async (data) => {
  if (data.role === 'ADMIN' && data.admin_code !== process.env.ADMIN_REGISTRATION_CODE) {
    // Deliberately checked before opening a transaction — no DB work should happen for a
    // request that can't possibly succeed.
    if (!process.env.ADMIN_REGISTRATION_CODE) {
      // Edge case: env var missing entirely is a server misconfiguration, not a client error —
      // never tell the client "wrong code" when there was no valid code to check against at all.
      const err = new Error('Server is not configured to accept admin registrations.');
      err.statusCode = 500;
      err.code = 'SERVER_MISCONFIGURATION';
      throw err;
    }
    const err = new Error('Invalid admin registration code.');
    err.statusCode = 403;
    err.code = 'INVALID_ADMIN_CODE';
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);

    const userResult = await client.query(
      `INSERT INTO users (phone, email, password_hash, role, status, full_name, otp_hash, otp_expires_at, otp_purpose)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW() + INTERVAL '${OTP_EXPIRY_MINUTES} minutes', 'registration')
       RETURNING id`,
      [data.phone, data.email ?? null, passwordHash, data.role, data.full_name, otpHash],
    );
    const userId = userResult.rows[0].id;

    if (data.role === 'FARMER') {
      await client.query(
        `INSERT INTO fpo_profiles (user_id, fpo_name, registration_number, state, district, primary_crop_types)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, data.fpo_name, data.registration_number, data.state, data.district, data.primary_crop_types],
      );
    } else if (data.role === 'CONSUMER') {
      await client.query(
        `INSERT INTO consumer_profiles (user_id, delivery_pincode) VALUES ($1, $2)`,
        [userId, data.delivery_pincode],
      );
    } else if (data.role === 'BULK_BUYER') {
      await client.query(
        `INSERT INTO bulk_buyer_profiles (user_id, company_name, gstin, business_type) VALUES ($1, $2, $3, $4)`,
        [userId, data.company_name, data.gstin, data.business_type],
      );
    } else if (data.role === 'LOGISTICS') {
      await client.query(
        `INSERT INTO logistics_profiles (user_id, vehicle_type, vehicle_registration_number, base_state, base_city)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, data.vehicle_type, data.vehicle_registration_number, data.base_state ?? null, data.base_city ?? null],
      );
    }
    // ADMIN: no profile table — the users row alone is sufficient, admin_code is never stored.

    await client.query('COMMIT');
    logger.info({ action: 'USER_REGISTERED', userId, role: data.role });
    return { userId, devOtp: otp };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint && UNIQUE_VIOLATION_MAP[err.constraint]) {
      const mapped = UNIQUE_VIOLATION_MAP[err.constraint];
      const mappedErr = new Error(mapped.message);
      mappedErr.statusCode = mapped.statusCode;
      mappedErr.code = mapped.code;
      throw mappedErr;
    }
    logger.error({ action: 'USER_REGISTRATION_FAILED', role: data.role, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { register };
