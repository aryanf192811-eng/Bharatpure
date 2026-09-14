const express = require('express');

const controller = require('../controllers/price.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/recommendation', requireRoles('FARMER', 'ADMIN'), controller.recommendation);
router.get('/market-rates', controller.marketRates); // any authenticated role, per BHARATPURE-API.md
router.get('/premium-calculator', requireRoles('FARMER'), controller.premiumCalculator);

module.exports = router;
