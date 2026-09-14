const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  logger.error({ action: 'DB_POOL_ERROR', err: err.message });
});

const query = async (text, params) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  logger.info({ action: 'DB_QUERY', text, duration: Date.now() - start, rows: result.rowCount });
  return result;
};

module.exports = { pool, query };
