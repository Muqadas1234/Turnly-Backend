const { AppError } = require('../utils/http');
const { suggestDepartment } = require('../services/ai.service');

// POST /api/ai/department-guide   { message }
const departmentGuide = async (req, res) => {
    const message = ((req.body && req.body.message) || '').trim();
    if (message.length < 3 || message.length > 600) throw new AppError(400, 'Describe your symptoms in 3-600 characters');
    res.json({ success: true, ...(await suggestDepartment(message)) });
};

module.exports = { departmentGuide };
