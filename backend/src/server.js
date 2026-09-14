require('dotenv').config();

const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info({ action: 'SERVER_STARTED', port: PORT, env: process.env.NODE_ENV || 'development' });
});

server.on('error', (err) => {
  logger.error({ action: 'SERVER_START_FAILED', err: err.message });
  process.exit(1);
});
