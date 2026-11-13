// Middleware to verify that the authenticated user has an 'admin' role
module.exports = function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Administrator privileges required.'
        });
    }
    next();
};c