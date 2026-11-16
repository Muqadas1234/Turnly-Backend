// Middleware to verify that the authenticated user has an 'admin' role
module.exports = function requireAdmin(req, res, next) {
    const role = req.userRole || req.user?.role;
    if (role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Administrator privileges required.'
        });
    }
    next();
};
