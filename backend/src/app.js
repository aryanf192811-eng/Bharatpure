require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const logger = require('./utils/logger');
const { sendError } = require('./utils/response');

const app = express();

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Global rate limiter — 100 requests/min. Route-specific limits (auth, etc.) are added
// per-route in later tasks; this is the catch-all floor.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => sendError(res, 429, 'RATE_LIMITED', 'Too many requests, please try again later.'),
});
app.use(globalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/batches', require('./routes/batch.routes'));
app.use('/api/quality', require('./routes/quality.routes'));
app.use('/api/listings', require('./routes/listing.routes'));
app.use('/api/demand', require('./routes/demand.routes'));
app.use('/api/price', require('./routes/price.routes'));
app.use('/api/simulation', require('./routes/simulation.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/qr', require('./routes/qr.routes'));
app.use('/api/disputes', require('./routes/dispute.routes'));
// Further route mounts land here as each domain is built.

app.use((req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Route not found');
});

// Global error handler — must be the last middleware. Never leaks a stack trace to the client.
// Checks both err.statusCode (our own thrown errors) and err.status (what express.json() sets
// on a malformed-JSON body via body-parser) so a bad request body correctly surfaces as 400,
// not a generic 500.
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  logger.error({ err: err.message, stack: err.stack });
  sendError(res, statusCode, code, err.message || 'An unexpected error occurred');
});

module.exports = app;
