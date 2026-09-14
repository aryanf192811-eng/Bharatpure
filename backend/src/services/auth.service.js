const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { pool } = require('../db');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;
const OTP_LOCKOUT_WINDOW_MINUTES = 15;
const OTP_LOCKOUT_MAX_ATTEMPTS = 5;

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

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

const sha256 = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * Issues a fresh access+refresh token pair for a user and persists the refresh token's hash.
 * Shared by verifyOtp, login, and refresh — the one place that knows how a session is minted.
 */
const issueTokenPair = async (client, userId, role, meta = {}) => {
  const accessToken = jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
  });

  const jti = crypto.randomUUID();
  const refreshToken = jwt.sign({ sub: userId, jti }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  });
  const decoded = jwt.decode(refreshToken);

  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, to_timestamp($3), $4, $5)`,
    [userId, sha256(refreshToken), decoded.exp, meta.ip_address ?? null, meta.user_agent ?? null],
  );

  return { accessToken, refreshToken };
};

/**
 * Verifies a registration/reset OTP and, on success, activates the account and mints a session.
 * Lockout is a rolling 15-minute failed-attempt count (self-expiring), not a persisted
 * users.status mutation — the schema has no "suspended_until" timestamp, so writing
 * status='suspended' here would be indistinguishable from a real admin-initiated suspension
 * and would never automatically clear. The otp_attempts table already gives us a natural,
 * self-expiring window for free.
 */
const verifyOtp = async (phone, otp, purpose, meta = {}) => {
  const client = await pool.connect();
  try {
    const userResult = await client.query(
      `SELECT id, otp_hash, otp_expires_at, role, status FROM users WHERE phone = $1 AND otp_purpose = $2`,
      [phone, purpose],
    );
    if (userResult.rows.length === 0) {
      throw apiError(404, 'USER_NOT_FOUND', 'No pending OTP for this phone number.');
    }
    const user = userResult.rows[0];

    const attemptsResult = await client.query(
      `SELECT COUNT(*) FROM otp_attempts
       WHERE user_id = $1 AND succeeded = FALSE AND attempted_at > NOW() - INTERVAL '${OTP_LOCKOUT_WINDOW_MINUTES} minutes'`,
      [user.id],
    );
    if (Number(attemptsResult.rows[0].count) >= OTP_LOCKOUT_MAX_ATTEMPTS) {
      throw apiError(429, 'TOO_MANY_ATTEMPTS', `Too many failed attempts. Try again in ${OTP_LOCKOUT_WINDOW_MINUTES} minutes.`);
    }

    if (new Date(user.otp_expires_at) <= new Date()) {
      throw apiError(400, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
    }

    const matches = await bcrypt.compare(otp, user.otp_hash);
    await client.query(`INSERT INTO otp_attempts (user_id, succeeded, ip_address) VALUES ($1, $2, $3)`, [
      user.id,
      matches,
      meta.ip_address ?? null,
    ]);

    if (!matches) {
      throw apiError(400, 'OTP_INVALID', 'Incorrect code.');
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE users SET status = 'active', otp_hash = NULL, otp_expires_at = NULL, otp_purpose = NULL, last_login_at = NOW()
       WHERE id = $1`,
      [user.id],
    );
    const tokens = await issueTokenPair(client, user.id, user.role, meta);
    await client.query('COMMIT');

    logger.info({ action: 'OTP_VERIFIED', userId: user.id, purpose });
    return { userId: user.id, role: user.role, ...tokens };
  } catch (err) {
    // ROLLBACK is a safe no-op if BEGIN was never reached (e.g. the OTP_INVALID/EXPIRED/
    // NOT_FOUND paths above return before opening a transaction) — Postgres just warns
    // "no transaction in progress" rather than erroring, so it's always safe to call here.
    await client.query('ROLLBACK');
    if (err.code && err.statusCode) throw err; // already a mapped API error, just propagate
    logger.error({ action: 'OTP_VERIFY_FAILED', phone, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Logs a user in by phone or email + password. Returns 401 for both "no such user" and "wrong
 * password" — never reveal which one it was, that's a user-enumeration leak.
 */
const login = async (identifier, password, meta = {}) => {
  const isEmail = identifier.includes('@');
  const client = await pool.connect();
  try {
    const userResult = await client.query(
      `SELECT id, password_hash, role, status FROM users WHERE ${isEmail ? 'email' : 'phone'} = $1`,
      [identifier],
    );
    if (userResult.rows.length === 0) {
      throw apiError(401, 'INVALID_CREDENTIALS', 'Incorrect phone/email or password.');
    }
    const user = userResult.rows[0];

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      throw apiError(401, 'INVALID_CREDENTIALS', 'Incorrect phone/email or password.');
    }

    if (user.status === 'pending') {
      throw apiError(403, 'OTP_REQUIRED', 'Please verify your phone number first.');
    }
    if (user.status === 'suspended') {
      throw apiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
    }

    await client.query('BEGIN');
    await client.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
    const tokens = await issueTokenPair(client, user.id, user.role, meta);
    await client.query('COMMIT');

    logger.info({ action: 'USER_LOGIN', userId: user.id });
    return { userId: user.id, role: user.role, ...tokens };
  } catch (err) {
    await client.query('ROLLBACK'); // safe no-op if BEGIN was never reached
    if (err.code && err.statusCode) throw err;
    logger.error({ action: 'LOGIN_FAILED', identifier, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Rotates a refresh token. Reuse of an already-revoked token is treated as evidence of theft:
 * every other active refresh token for that user is revoked too, forcing a full re-login
 * everywhere. This is the one function where "token not found/expired" and "token found but
 * already revoked" must be told apart internally even though they return the same client-facing
 * error, because only the second case triggers the theft response.
 */
const refresh = async (refreshToken, meta = {}) => {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw apiError(401, err.name === 'TokenExpiredError' ? 'REFRESH_TOKEN_EXPIRED' : 'REFRESH_TOKEN_INVALID', 'Invalid session, please log in again.');
  }

  const client = await pool.connect();
  try {
    const tokenHash = sha256(refreshToken);
    const tokenResult = await client.query(
      `SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );

    if (tokenResult.rows.length === 0) {
      throw apiError(401, 'REFRESH_TOKEN_INVALID', 'Invalid session, please log in again.');
    }
    const stored = tokenResult.rows[0];

    if (stored.revoked_at !== null) {
      // Theft detection: this exact refresh token was already used once before. Revoke every
      // other still-active token for this user so a stolen token can't keep minting new sessions.
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
        [stored.user_id],
      );
      logger.error({ action: 'REFRESH_TOKEN_REUSE_DETECTED', userId: stored.user_id });
      throw apiError(401, 'REFRESH_TOKEN_INVALID', 'Invalid session, please log in again.');
    }

    if (new Date(stored.expires_at) <= new Date()) {
      throw apiError(401, 'REFRESH_TOKEN_EXPIRED', 'Session expired, please log in again.');
    }

    const userResult = await client.query(`SELECT role FROM users WHERE id = $1`, [stored.user_id]);
    if (userResult.rows.length === 0) {
      throw apiError(401, 'REFRESH_TOKEN_INVALID', 'Invalid session, please log in again.');
    }

    await client.query('BEGIN');
    await client.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [stored.id]);
    const tokens = await issueTokenPair(client, stored.user_id, userResult.rows[0].role, meta);
    await client.query('COMMIT');

    logger.info({ action: 'TOKEN_REFRESHED', userId: stored.user_id });
    return { userId: stored.user_id, ...tokens };
  } catch (err) {
    await client.query('ROLLBACK'); // safe no-op if BEGIN was never reached
    if (err.code && err.statusCode) throw err;
    logger.error({ action: 'TOKEN_REFRESH_FAILED', err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { register, verifyOtp, login, refresh };
