const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const controller = require('../controllers/auth.controller');
const { sendError } = require('../utils/response');

const router = express.Router();

const rateLimited = (code, windowMs, max, opts = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => sendError(res, 429, code, 'Too many requests, please try again later.'),
    ...opts,
  });

// Keyed by phone (the "user" in "5/15min/user") rather than IP — falls back to IP if the body
// hasn't been parsed into a phone yet (shouldn't happen post express.json(), but keeps the
// limiter from crashing on a malformed request). Falls through ipKeyGenerator() rather than
// raw req.ip so an IPv6 /64 subnet can't be used to dodge the limit by rotating the tail bits —
// express-rate-limit refuses to start otherwise (ERR_ERL_KEY_GEN_IPV6).
const byPhoneKey = (req) => req.body?.phone || ipKeyGenerator(req.ip);

router.post('/register', rateLimited('RATE_LIMITED', 60 * 60 * 1000, 3), controller.register);
router.post('/verify-otp', rateLimited('RATE_LIMITED', 15 * 60 * 1000, 5, { keyGenerator: byPhoneKey }), controller.verifyOtp);
router.post('/login', rateLimited('RATE_LIMITED', 15 * 60 * 1000, 10), controller.login);
router.post('/forgot-password', rateLimited('RATE_LIMITED', 60 * 60 * 1000, 3), controller.forgotPassword);
router.post('/verify-reset-otp', rateLimited('RATE_LIMITED', 15 * 60 * 1000, 5, { keyGenerator: byPhoneKey }), controller.verifyResetOtp);
router.post('/reset-password', controller.resetPassword);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

module.exports = router;
