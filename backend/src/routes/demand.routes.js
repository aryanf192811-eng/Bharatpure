const express = require('express');

const controller = require('../controllers/demand.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/forecast', requireRoles('FARMER', 'ADMIN', 'BULK_BUYER'), controller.forecast);
router.get('/multi-city', requireRoles('FARMER', 'ADMIN'), controller.multiCity);
router.post('/refresh', requireRoles('ADMIN'), controller.refresh);

module.exports = router;
