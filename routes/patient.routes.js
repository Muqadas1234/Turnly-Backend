const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const patientController = require('../controllers/patient.controller');

// Public / Patient hospital browsing
router.get('/hospitals', patientController.getApprovedHospitals);
router.get('/hospitals/:id', patientController.getHospitalDetails);

// Patient active token (requires patient authentication)
router.get('/active-token', authMiddleware, patientController.getActiveToken);


// Doctor queue status preview
router.get('/doctors/:id/queue-status', patientController.getDoctorQueueStatus);

// Book token (requires patient authentication)
router.post('/tokens/book', authMiddleware, patientController.bookToken);

module.exports = router;
