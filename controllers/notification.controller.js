const pool = require('../config/db');
const { AppError, needId } = require('../utils/http');

// GET /api/notifications?limit=
const list = async (req, res) => {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const { rows } = await pool.query('SELECT id, type, title, body, data, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [req.userId, limit]);
    const unread = await pool.query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [req.userId]);
    res.json({ success: true, notifications: rows, unread_count: unread.rows[0].n });
};

const markRead = async (req, res) => {
    const r = await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [needId(req.params.id, 'id'), req.userId]);
    if (!r.rowCount) throw new AppError(404, 'Notification not found');
    res.json({ success: true });
};

const markAllRead = async (req, res) => {
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read', [req.userId]);
    res.json({ success: true, message: 'All notifications marked as read' });
};

module.exports = { list, markRead, markAllRead };
