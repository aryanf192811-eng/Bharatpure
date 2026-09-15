const express = require('express');

const controller = require('../controllers/farmer.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, requireRoles('FARMER'));

router.get('/profile', controller.getProfile);
router.get('/dashboard', controller.getDashboard);
router.get('/earnings', controller.getEarnings);
router.get('/trust-score', controller.getTrustScore);

module.exports = router;
