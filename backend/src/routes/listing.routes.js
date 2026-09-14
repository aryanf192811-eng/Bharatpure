const express = require('express');

const controller = require('../controllers/listing.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.post('/', requireRoles('FARMER'), controller.create);
router.get('/recommended', requireRoles('CONSUMER', 'BULK_BUYER'), controller.recommended); // before :listingId
router.get('/', controller.list);
router.get('/:listingId', controller.getById);
router.patch('/:listingId', requireRoles('FARMER', 'ADMIN'), controller.update);
router.patch('/:listingId/status', requireRoles('FARMER', 'ADMIN'), controller.updateStatus);

module.exports = router;
