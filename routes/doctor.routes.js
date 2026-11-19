const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { requireRole, managerHospital } = require('../middleware/role');
const { h } = require('../utils/http');
const { listMyDoctors, createDoctor, updateDoctor, toggleDoctor, deleteDoctor, getDoctor } = require('../controllers/doctor.controller');

const manager = [verifyToken, requireRole('manager'), managerHospital];

router.get('/', ...manager, h(listMyDoctors));
router.post('/', ...manager, h(createDoctor));
router.put('/:id', ...manager, h(updateDoctor));
router.patch('/:id/toggle', ...manager, h(toggleDoctor));
router.delete('/:id', ...manager, h(deleteDoctor));

// any logged-in user: doctor details + availability + live queue summary
router.get('/:id', verifyToken, h(getDoctor));

module.exports = router;
