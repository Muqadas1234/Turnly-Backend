const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { h } = require('../utils/http');
const f = require('../controllers/family.controller');

router.use(verifyToken, requireRole('patient'));
router.get('/', h(f.list));
router.post('/', h(f.create));
router.put('/:id', h(f.update));
router.delete('/:id', h(f.remove));

module.exports = router;
