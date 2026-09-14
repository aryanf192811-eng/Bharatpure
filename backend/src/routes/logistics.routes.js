const express = require('express');

const controller = require('../controllers/logistics.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/dashboard', requireRoles('LOGISTICS'), controller.dashboard);
router.get('/routes', requireRoles('LOGISTICS', 'ADMIN'), controller.listRoutes);
router.get('/routes/:routeId', requireRoles('LOGISTICS', 'ADMIN'), controller.getRoute);
router.patch('/routes/:routeId/start', requireRoles('LOGISTICS', 'ADMIN'), controller.startRoute);
router.patch('/routes/:routeId/stops/:stopId/complete', requireRoles('LOGISTICS', 'ADMIN'), controller.completeStop);
router.post('/temperature-log', requireRoles('LOGISTICS'), controller.logTemperature);

module.exports = router;
