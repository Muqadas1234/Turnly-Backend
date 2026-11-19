const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { h } = require('../utils/http');
const { departmentGuide } = require('../controllers/ai.controller');

router.post('/department-guide', verifyToken, rateLimit({ windowMs: 10 * 60 * 1000, max: 20 }), h(departmentGuide));

module.exports = router;
