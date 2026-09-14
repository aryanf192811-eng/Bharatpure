const express = require('express');

const controller = require('../controllers/quality.controller');
const { verifyToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.post('/tests', requireRoles('FARMER', 'ADMIN'), controller.submitTest);
router.get('/batches/:batchId/tests', controller.getBatchTests);
router.post('/certificates', requireRoles('FARMER', 'ADMIN'), controller.uploadMiddleware, controller.uploadCertificate);
router.get('/b-samples/:batchId', controller.getBSamples);
router.post('/b-samples/:batchId/request', requireRoles('FARMER'), controller.requestBSample);

module.exports = router;
