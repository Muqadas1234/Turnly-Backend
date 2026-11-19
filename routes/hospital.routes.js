const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { requireRole, managerHospital } = require('../middleware/role');
const { h } = require('../utils/http');
const {
    registerHospital, resubmitHospital, getMyHospital, updateMyHospital, updateHospitalStatus,
} = require('../controllers/hospital.controller');
const {
    listHospitals, listCities, getHospital, listHospitalDepartments, listHospitalDoctors,
} = require('../controllers/browse.controller');

// ---- Manager ----
router.post('/register', verifyToken, requireRole('manager'), registerHospital);
router.put('/resubmit', verifyToken, requireRole('manager'), resubmitHospital);
router.get('/my-hospital', verifyToken, getMyHospital);
router.patch('/my-hospital', verifyToken, requireRole('manager'), managerHospital, h(updateMyHospital));

// ---- Patient browsing (approved hospitals only) ----
router.get('/cities', verifyToken, h(listCities));
router.get('/', verifyToken, h(listHospitals));
router.get('/:id', verifyToken, h(getHospital));
router.get('/:id/departments', verifyToken, h(listHospitalDepartments));
router.get('/:id/doctors', verifyToken, h(listHospitalDoctors));

// ---- Admin ----
router.patch('/:id/status', verifyToken, updateHospitalStatus);

module.exports = router;
