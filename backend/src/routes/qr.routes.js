const express = require('express');

const controller = require('../controllers/qr.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

// Public -- no verifyToken. req.user will simply be undefined, handled gracefully in the controller.
router.get('/scan/:qrHash', controller.scan);

router.post('/burn/:qrHash', verifyToken, controller.burn);
router.get('/generate/:batchId', verifyToken, requireRoles('FARMER', 'ADMIN'), controller.generate);

module.exports = router;
