// Manager queue control: Call Next, Complete, Skip no-show, Recall, Priority
const { AppError, needId } = require('../utils/http');
const { todayStr, isDateStr } = require('../utils/dates');
const queue = require('../services/queue.service');
const { managerStats } = require('../services/stats.service');

const dateOf = (v) => {
    if (v === undefined || v === null || v === '') return todayStr();
    if (!isDateStr(v)) throw new AppError(400, 'Invalid date, use YYYY-MM-DD');
    return v;
};

// GET /api/queue/stats?date=         (manager dashboard)
const stats = async (req, res) => {
    res.json({ success: true, stats: await managerStats(req.hospital.id, dateOf(req.query.date)) });
};

// GET /api/queue/:doctorId?date=
const overview = async (req, res) => {
    res.json({ success: true, queue: await queue.getOverview(req.hospital.id, needId(req.params.doctorId, 'doctor id'), dateOf(req.query.date)) });
};

// POST /api/queue/:doctorId/call-next   { date? }
const callNext = async (req, res) => {
    const r = await queue.callNext(req.hospital.id, needId(req.params.doctorId, 'doctor id'), dateOf(req.body && req.body.date));
    res.json({ success: true, message: `Token #${r.token.token_number} is now being served`, ...r });
};

const complete = async (req, res) => res.json({ success: true, message: 'Token marked as done', token: await queue.complete(req.hospital.id, needId(req.params.id, 'token id')) });
const completeCurrent = async (req, res) => {
    const token = await queue.completeCurrent(req.hospital.id, needId(req.params.doctorId, 'doctor id'), dateOf(req.body && req.body.date));
    res.json({ success: true, message: `Token #${token.token_number} marked as done`, token });
};
const skip = async (req, res) => res.json({ success: true, message: 'Token skipped', token: await queue.skip(req.hospital.id, needId(req.params.id, 'token id')) });
const recall = async (req, res) => res.json({ success: true, message: 'Token put back in the queue', token: await queue.recall(req.hospital.id, needId(req.params.id, 'token id')) });
const cancel = async (req, res) => res.json({ success: true, message: 'Token cancelled', token: await queue.managerCancel(req.hospital.id, needId(req.params.id, 'token id')) });

// PATCH /api/queue/tokens/:id/priority   { approved: true|false }
const priority = async (req, res) => {
    const approved = req.body && req.body.approved;
    if (typeof approved !== 'boolean') throw new AppError(400, 'approved (true/false) is required');
    res.json({ success: true, message: approved ? 'Priority approved' : 'Priority rejected', token: await queue.setPriority(req.hospital.id, needId(req.params.id, 'token id'), approved) });
};

module.exports = { stats, overview, callNext, complete, completeCurrent, skip, recall, cancel, priority };
