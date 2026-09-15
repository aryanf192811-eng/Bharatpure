const express = require('express');

const controller = require('../controllers/buyer.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, requireRoles('BULK_BUYER'));

router.get('/profile', controller.getProfile);
router.get('/dashboard', controller.getDashboard);
router.get('/reliability', controller.getReliability);

module.exports = router;
