const pool = require('../config/db');
const { AppError, h } = require('../utils/http');

// Use AFTER verifyToken:  router.post('/', verifyToken, requireRole('manager'), handler)
const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.userRole)) {
        return res.status(403).json({ success: false, message: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
};

// Loads the logged-in manager's own hospital into req.hospital (any status)
const managerHospital = h(async (req, res, next) => {
    const { rows } = await pool.query('SELECT * FROM hospitals WHERE manager_id = $1 LIMIT 1', [req.userId]);
    if (!rows[0]) throw new AppError(404, 'You have not registered a hospital yet', 'NO_HOSPITAL');
    req.hospital = rows[0];
    next();
});

// Same, but the hospital must be approved by the admin
const approvedHospital = [
    managerHospital,
    (req, res, next) => {
        if (req.hospital.status !== 'approved') {
            return next(new AppError(403, `Your hospital is ${req.hospital.status}. This action needs an approved hospital.`, 'HOSPITAL_NOT_APPROVED'));
        }
        next();
    },
];

module.exports = { requireRole, managerHospital, approvedHospital };
