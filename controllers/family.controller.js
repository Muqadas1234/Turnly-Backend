const pool = require('../config/db');
const { AppError, needId } = require('../utils/http');

const MAX = () => Number(process.env.MAX_FAMILY_MEMBERS) || 10;

function parse(b, partial = false) {
    const out = {};
    if (!partial || b.name !== undefined) {
        if (!b.name || String(b.name).trim().length < 2) throw new AppError(400, 'Name is required (min 2 characters)');
        out.name = String(b.name).trim();
    }
    if (!partial || b.age !== undefined) {
        const age = Number(b.age);
        if (!Number.isInteger(age) || age < 0 || age > 120) throw new AppError(400, 'Age must be a number between 0 and 120');
        out.age = age;
    }
    if (!partial || b.relation !== undefined) {
        if (!b.relation || !String(b.relation).trim()) throw new AppError(400, 'Relation is required');
        out.relation = String(b.relation).trim();
    }
    return out;
}

const list = async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, relation, age, created_at FROM family_members WHERE user_id = $1 ORDER BY created_at', [req.userId]);
    res.json({ success: true, family_members: rows });
};

const create = async (req, res) => {
    const n = await pool.query('SELECT COUNT(*)::int AS n FROM family_members WHERE user_id = $1', [req.userId]);
    if (n.rows[0].n >= MAX()) throw new AppError(409, `You can save up to ${MAX()} family members`, 'LIMIT_REACHED');
    const f = parse(req.body || {});
    const { rows } = await pool.query('INSERT INTO family_members (user_id, name, relation, age) VALUES ($1,$2,$3,$4) RETURNING id, name, relation, age, created_at', [req.userId, f.name, f.relation, f.age]);
    res.status(201).json({ success: true, message: 'Family member added', family_member: rows[0] });
};

const update = async (req, res) => {
    const id = needId(req.params.id, 'id');
    const f = parse(req.body || {}, true);
    const { rows } = await pool.query(
        `UPDATE family_members SET name = COALESCE($3, name), relation = COALESCE($4, relation), age = COALESCE($5, age)
          WHERE id = $1 AND user_id = $2 RETURNING id, name, relation, age, created_at`,
        [id, req.userId, f.name ?? null, f.relation ?? null, f.age ?? null]);
    if (!rows[0]) throw new AppError(404, 'Family member not found');
    res.json({ success: true, message: 'Family member updated', family_member: rows[0] });
};

const remove = async (req, res) => {
    const r = await pool.query('DELETE FROM family_members WHERE id = $1 AND user_id = $2', [needId(req.params.id, 'id'), req.userId]);
    if (!r.rowCount) throw new AppError(404, 'Family member not found');
    res.json({ success: true, message: 'Family member removed' });
};

module.exports = { list, create, update, remove };
