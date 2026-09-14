const express = require('express');

const controller = require('../controllers/dispute.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.post('/', requireRoles('CONSUMER', 'BULK_BUYER'), controller.create);
router.get('/', controller.list); // role-scoped inside the service
router.get('/:disputeId', controller.getById);
router.post('/:disputeId/evidence', controller.addEvidence);
router.patch('/:disputeId/resolve', requireRoles('ADMIN'), controller.resolve);

module.exports = router;
