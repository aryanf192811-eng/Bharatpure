require('dotenv').config();

const { pool } = require('../src/db');
const { seed } = require('../src/db/seed');
const logger = require('../src/utils/logger');

// Truncates every application table (everything except node-pg-migrate's own bookkeeping
// table) and re-seeds from scratch. Exists because newman regression runs and ad-hoc manual
// testing both mutate real rows through the real API (batches change status, orders/escrow
// get created, listings pile up) -- unlike seed.js's own upserts, that drift never undoes
// itself. Run this after (and ideally before) any test pass to hand back a clean, demo-ready
// database rather than one full of test debris.
const resetDb = async () => {
  const client = await pool.connect();
  try {
    const tablesResult = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'pgmigrations'`,
    );
    const tableNames = tablesResult.rows.map((r) => `"${r.tablename}"`);
    if (tableNames.length === 0) {
      logger.info({ action: 'DB_RESET_NO_TABLES' });
      return;
    }
    await client.query(`TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`);
    logger.info({ action: 'DB_RESET_TRUNCATED', tableCount: tableNames.length });
  } finally {
    client.release();
  }
  await seed();
};

if (require.main === module) {
  resetDb()
    .then(() => {
      logger.info({ action: 'DB_RESET_COMPLETE' });
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ action: 'DB_RESET_FAILED', err: err.message });
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { resetDb };
