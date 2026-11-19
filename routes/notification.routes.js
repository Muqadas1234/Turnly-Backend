const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { h } = require('../utils/http');
const n = require('../controllers/notification.controller');

router.use(verifyToken);
router.get('/', h(n.list));
router.put('/read-all', h(n.markAllRead));
router.put('/:id/read', h(n.markRead));

module.exports = router;
