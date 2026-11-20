const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { h } = require('../utils/http');
const { book, mine, getOne, cancel } = require('../controllers/token.controller');

router.post('/', verifyToken, requireRole('patient'), h(book));
router.get('/my', verifyToken, requireRole('patient'), h(mine));
router.get('/:id', verifyToken, h(getOne));
router.post('/:id/cancel', verifyToken, requireRole('patient'), h(cancel));

module.exports = router;
