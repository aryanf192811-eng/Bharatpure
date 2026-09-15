const express = require('express');

const controller = require('../controllers/users.controller');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

// Minimal: echoes the verified JWT claims. The full version (profile + role-specific data
// joined in, per BHARATPURE-API.md's Users section) belongs to a later Users-domain task.
router.get('/me', controller.me);

router.get('/me/notifications', controller.listNotifications);
router.patch('/me/notifications/:notificationId/read', controller.markNotificationRead);

module.exports = router;
