const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const {
    getDepartments,
    createDepartment,
    toggleDepartment,
    updateDepartment,
    deleteDepartment,
} = require('../controllers/department.controller');

// anyone logged in can read (patients only see active departments of approved hospitals)
router.get('/', verifyToken, getDepartments);

// only the hospital's manager can change departments
router.post('/', verifyToken, requireRole('manager'), createDepartment);
router.patch('/:id/toggle', verifyToken, requireRole('manager'), toggleDepartment);
router.put('/:id', verifyToken, requireRole('manager'), updateDepartment);
router.delete('/:id', verifyToken, requireRole('manager'), deleteDepartment);

module.exports = router;
