const { z } = require('zod');

const authService = require('../services/auth.service');
const { registerSchema } = require('../validators/auth.validator');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7d, matches JWT_REFRESH_EXPIRY default

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
});

const requestMeta = (req) => ({ ip_address: req.ip, user_agent: req.headers['user-agent'] });

// Schemas defined once at module load, not per-request.
const verifyOtpBodySchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/),
  otp: z.string().length(6),
  purpose: z.enum(['registration', 'password_reset']),
});
const loginBodySchema = z.object({ identifier: z.string().min(1), password: z.string().min(1) });
const forgotPasswordBodySchema = z.object({ phone: z.string().regex(/^[6-9]\d{9}$/) });
const verifyResetOtpBodySchema = z.object({ phone: z.string().regex(/^[6-9]\d{9}$/), otp: z.string().length(6) });
const resetPasswordBodySchema = z.object({ newPassword: z.string().min(8) });

const register = async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await authService.register(parsed.data);
    logger.info({ action: 'REGISTER_ROUTE_OK', userId: result.userId });
    return sendSuccess(res, result, 201, 'OTP sent to your phone.');
  } catch (err) {
    return next(err);
  }
};

const verifyOtp = async (req, res, next) => {
  const parsed = verifyOtpBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const { phone, otp, purpose } = parsed.data;
    const result = await authService.verifyOtp(phone, otp, purpose, requestMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions());
    return sendSuccess(
      res,
      { accessToken: result.accessToken, user: { id: result.userId, role: result.role, full_name: result.fullName, status: result.status } },
      200,
    );
  } catch (err) {
    return next(err);
  }
};

const login = async (req, res, next) => {
  const parsed = loginBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const { identifier, password } = parsed.data;
    const result = await authService.login(identifier, password, requestMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions());
    return sendSuccess(
      res,
      { accessToken: result.accessToken, user: { id: result.userId, role: result.role, full_name: result.fullName, status: result.status } },
      200,
    );
  } catch (err) {
    return next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  const parsed = forgotPasswordBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await authService.forgotPassword(parsed.data.phone);
    return sendSuccess(res, result, 200, 'Reset OTP sent.');
  } catch (err) {
    return next(err);
  }
};

const verifyResetOtp = async (req, res, next) => {
  const parsed = verifyResetOtpBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  try {
    const result = await authService.verifyResetOtp(parsed.data.phone, parsed.data.otp);
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
};

const resetPassword = async (req, res, next) => {
  const parsed = resetPasswordBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.issues);
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'INVALID_RESET_TOKEN', 'Missing reset token.');
  }
  try {
    const resetToken = authHeader.slice('Bearer '.length);
    const result = await authService.resetPassword(resetToken, parsed.data.newPassword);
    return sendSuccess(res, result, 200, 'Password reset successful.');
  } catch (err) {
    return next(err);
  }
};

const refresh = async (req, res, next) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    return sendError(res, 401, 'REFRESH_TOKEN_INVALID', 'No refresh token provided.');
  }
  try {
    const result = await authService.refresh(token, requestMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions());
    return sendSuccess(res, { accessToken: result.accessToken }, 200);
  } catch (err) {
    return next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    await authService.logout(token);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};

module.exports = { register, verifyOtp, login, forgotPassword, verifyResetOtp, resetPassword, refresh, logout };
