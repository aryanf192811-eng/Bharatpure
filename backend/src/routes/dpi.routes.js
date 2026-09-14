const express = require('express');

const controller = require('../controllers/dpi.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/agristack/farmer/:farmerId', verifyToken, requireRoles('ADMIN', 'FARMER'), controller.agristackFarmer);
router.get('/enam/prices', verifyToken, controller.enamPrices); // any authenticated role
router.get('/ondc/listings', verifyToken, requireRoles('ADMIN'), controller.ondcListings);

module.exports = router;
