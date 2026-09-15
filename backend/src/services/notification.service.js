const { pool } = require('../db');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const listForUser = async (userId, { unreadOnly = false, page = 1, limit = 20 }) => {
  const conditions = [`user_id = $1`];
  const params = [userId];
  if (unreadOnly) conditions.push(`read_at IS NULL`);
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const countResult = await pool.query(`SELECT COUNT(*) FROM notifications ${whereClause}`, params);
  const dataResult = await pool.query(
    `SELECT id, type, title, body, metadata, read_at, created_at FROM notifications ${whereClause}
     ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

const markRead = async (notificationId, userId) => {
  const result = await pool.query(
    `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING id, read_at`,
    [notificationId, userId],
  );
  if (result.rows.length === 0) {
    // Idempotent-friendly: if it's already read, that's not an error condition for the caller.
    const existing = await pool.query(`SELECT id, read_at FROM notifications WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
    if (existing.rows.length === 0) {
      throw apiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }
    return existing.rows[0];
  }
  return result.rows[0];
};

module.exports = { listForUser, markRead };
