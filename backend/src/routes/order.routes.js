const express = require('express');

const controller = require('../controllers/order.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.post('/', requireRoles('CONSUMER', 'BULK_BUYER'), controller.create);
router.get('/', controller.list); // role-scoped inside the service
router.get('/:orderId', controller.getById);
router.get('/:orderId/impact', controller.getImpact); // ownership checked inside the service, same as getById
router.patch('/:orderId/cancel', requireRoles('CONSUMER', 'BULK_BUYER', 'ADMIN'), controller.cancel);
router.patch('/:orderId/delivered', requireRoles('LOGISTICS', 'ADMIN'), controller.markDelivered);

module.exports = router;
