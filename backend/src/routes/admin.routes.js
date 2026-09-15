const express = require('express');

const controller = require('../controllers/admin.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, requireRoles('ADMIN'));

router.get('/dashboard', controller.dashboard);
router.get('/batches', controller.batches);
router.get('/users', controller.users);
router.patch('/users/:userId/status', controller.updateUserStatus);
router.get('/escrow', controller.escrow);
router.post('/escrow/:escrowId/release', controller.releaseEscrow);
router.get('/iei', controller.iei);
router.get('/audit-logs', controller.auditLogs);
router.post('/routes/optimize', controller.optimizeRoutes);
router.post('/jobs/trust-scores', controller.triggerTrustScoreJob);
router.post('/jobs/crop-advisories', controller.triggerCropAdvisoryJob);

module.exports = router;
