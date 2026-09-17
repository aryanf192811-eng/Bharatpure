const { pool } = require('../db');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

/**
 * req.user only ever carries { id, role } decoded straight off the JWT (see auth.middleware.js)
 * -- nothing else about the user is looked up per-request, so any endpoint needing the actual
 * profile (name, phone, email, status) has to fetch it here rather than trusting the token.
 */
const getProfile = async (userId) => {
  const result = await pool.query(
    `SELECT id, phone, email, role, full_name, status FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  if (result.rows.length === 0) {
    throw apiError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  return result.rows[0];
};

module.exports = { getProfile };
