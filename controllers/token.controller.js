const { AppError, needId } = require('../utils/http');
const tokens = require('../services/token.service');

// POST /api/tokens   { doctor_id, date?, family_member_id?, priority_category?, notes? }
const book = async (req, res) => {
    const b = req.body || {};
    const doctorId = needId(b.doctor_id, 'doctor_id');
    const familyId = b.family_member_id != null ? needId(b.family_member_id, 'family_member_id') : null;
    const token = await tokens.bookToken(req.userId, {
        doctor_id: doctorId, date: b.date, family_member_id: familyId, priority_category: b.priority_category, notes: b.notes,
    });
    res.status(201).json({ success: true, message: 'Token booked successfully', token });
};

// GET /api/tokens/my?scope=active|history
const mine = async (req, res) => {
    const list = await tokens.listMine(req.userId, req.query.scope, Math.min(100, parseInt(req.query.limit, 10) || 50));
    res.json({ success: true, tokens: list });
};

// GET /api/tokens/:id   (token + live position / ETA / mini queue)
const getOne = async (req, res) => {
    res.json({ success: true, token: await tokens.getTokenFor(req.userId, req.userRole, needId(req.params.id, 'token id')) });
};

// POST /api/tokens/:id/cancel
const cancel = async (req, res) => {
    res.json({ success: true, message: 'Token cancelled', token: await tokens.cancelOwn(req.userId, needId(req.params.id, 'token id')) });
};

module.exports = { book, mine, getOne, cancel };
