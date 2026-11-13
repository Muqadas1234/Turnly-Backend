const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const adminController = require('../controllers/admin.controller');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// Hospital management routes
router.get('/hospitals', adminController.getHospitals);
router.get('/hospitals/:id', adminController.getHospitalById);
router.put('/hospitals/:id/approve', adminController.approveHospital);
router.put('/hospitals/:id/reject', adminController.rejectHospital);
router.put('/hospitals/:id/suspend', adminController.suspendHospital);

// Platform stats route
router.get('/stats', adminController.getPlatformStats);

module.exports = router;