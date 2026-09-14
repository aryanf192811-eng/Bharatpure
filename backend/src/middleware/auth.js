const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');

/**
 * Extracts and verifies the Bearer access token, attaching { id, role } to req.user.
 * 401 on missing header, malformed header, expired token, or invalid signature — the client
 * can't distinguish these from each other on purpose (don't leak which specific thing was wrong
 * with the token).
 */
const verifyToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return sendError(res, 401, 'UNAUTHENTICATED', 'Missing or malformed Authorization header.');
  }

  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (!decoded.sub || !decoded.role) {
      // A structurally valid JWT signed with our secret but missing expected access-token
      // claims (e.g. a resetToken from auth.service.js's verifyResetOtp, which only carries
      // sub+purpose) must not be treated as a usable session.
      return sendError(res, 401, 'UNAUTHENTICATED', 'Invalid access token.');
    }
    req.user = { id: decoded.sub, role: decoded.role };
    return next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return sendError(res, 401, code, 'Invalid or expired access token.');
  }
};

/**
 * Route-guard factory: requireRoles('ADMIN', 'FARMER') etc. Must run after verifyToken.
 */
const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
  }
  if (!roles.includes(req.user.role)) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to perform this action.');
  }
  return next();
};

module.exports = { verifyToken, requireRoles };
