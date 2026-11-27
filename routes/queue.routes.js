// Manager queue control (hospital must be approved)
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { requireRole, approvedHospital } = require('../middleware/role');
const { h } = require('../utils/http');
const q = require('../controllers/queue.controller');

router.use(verifyToken, requireRole('manager'), approvedHospital);

router.get('/stats', h(q.stats));
router.post('/tokens/:id/complete', h(q.complete));
router.post('/tokens/:id/skip', h(q.skip));
router.post('/tokens/:id/recall', h(q.recall));
router.post('/tokens/:id/cancel', h(q.cancel));
router.patch('/tokens/:id/priority', h(q.priority));
router.get('/:doctorId', h(q.overview));
router.post('/:doctorId/call-next', h(q.callNext));
router.post('/:doctorId/complete-current', h(q.completeCurrent));

module.exports = router;
