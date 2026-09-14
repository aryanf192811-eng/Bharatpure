const express = require('express');

const controller = require('../controllers/simulation.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.post('/run', requireRoles('ADMIN', 'FARMER'), controller.run);
router.get('/history', requireRoles('ADMIN'), controller.history);

module.exports = router;
