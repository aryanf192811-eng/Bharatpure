const express = require('express');

const { verifyToken } = require('../middleware/auth');
const { sendSuccess } = require('../utils/response');

const router = express.Router();

// STUB: minimal implementation, added ahead of its own task purely so TASK-009's acceptance
// check ("GET /api/users/me without token -> 401") has a real protected route to exercise.
// The full version (profile + role-specific data joined in, per BHARATPURE-API.md's Users
// section) belongs to a later Users-domain task — this only echoes the verified JWT claims.
router.get('/me', verifyToken, (req, res) => {
  return sendSuccess(res, { id: req.user.id, role: req.user.role });
});

module.exports = router;
