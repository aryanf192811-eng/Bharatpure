const express = require('express');

const controller = require('../controllers/cluster.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, requireRoles('FARMER', 'ADMIN'));

router.get('/', controller.list);
router.get('/:clusterId', controller.getById);

module.exports = router;
