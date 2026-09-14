const express = require('express');

const controller = require('../controllers/batch.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.post('/', requireRoles('FARMER'), controller.create);
router.get('/', controller.list); // role-scoped inside the service, not route-guarded
router.get('/:batchId', controller.getById);
router.delete('/:batchId', requireRoles('FARMER', 'ADMIN'), controller.remove);

module.exports = router;
