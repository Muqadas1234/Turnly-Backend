const pool = require('../config/db');
const { tx } = require('../utils/db');
const { AppError } = require('../utils/http');
const { todayStr, nowMinutes, diffDays, weekday, parseHM, isDateStr } = require('../utils/dates');
const { sortWaiting } = require('../utils/queue');
const { notifyUser, templates } = require('./notify');
const { TOKEN_JOIN, getToken, refreshQueue, emitTokenUpdate } = require('./queue.service');

const PRIORITY_CATEGORIES = ['elderly', 'disabled', 'pregnant', 'urgent'];
const MAX_ADVANCE_DAYS = () => Number(process.env.MAX_ADVANCE_BOOKING_DAYS) || 7;

/**
 * Book a token - runs in ONE transaction:
 *  1. the department row is locked, so department limits cannot be overshot by parallel bookings
 *  2. the token_counters upsert hands out the next number atomically and enforces the doctor's daily limit
 *     (two patients booking in the same millisecond can never get the same number)
 *  3. a partial unique index stops the same person holding two live tokens with one doctor on one day
 */
async function bookToken(userId, { doctor_id, date, family_member_id, priority_category, notes }) {
    const today = todayStr();
    const day = date || today;
    if (!isDateStr(day)) throw new AppError(400, 'Invalid date, use YYYY-MM-DD');
    if (day < today) throw new AppError(400, 'You cannot book a token for a past date');
    if (diffDays(day, today) > MAX_ADVANCE_DAYS()) throw new AppError(400, `You can book up to ${MAX_ADVANCE_DAYS()} days in advance`);
    if (priority_category && !PRIORITY_CATEGORIES.includes(priority_category)) {
        throw new AppError(400, `priority_category must be one of: ${PRIORITY_CATEGORIES.join(', ')}`);
    }

    const tokenId = await tx(async (c) => {
        const u = await c.query('SELECT id, name FROM users WHERE id = $1', [userId]);
        const user = u.rows[0];
        if (!user) throw new AppError(404, 'User not found');

        const dq = await c.query(
            `SELECT d.*, h.status AS hospital_status, dep.is_active AS dep_active, dep.daily_token_limit AS dep_limit
               FROM doctors d
               JOIN hospitals h ON h.id = d.hospital_id
               LEFT JOIN departments dep ON dep.id = d.department_id
              WHERE d.id = $1`, [doctor_id]);
        const d = dq.rows[0];
        if (!d || d.is_available === false || d.dep_active === false) throw new AppError(404, 'Doctor not found or unavailable');
        if (d.hospital_status !== 'approved') throw new AppError(409, 'This hospital is not accepting tokens right now', 'HOSPITAL_UNAVAILABLE');

        const days = d.schedule_days || [];
        if (!days.includes(weekday(day))) throw new AppError(409, `${d.name} does not see patients on ${weekday(day)}`, 'DOCTOR_NOT_AVAILABLE');
        if (day === today && d.schedule_to && nowMinutes() >= parseHM(d.schedule_to)) {
            throw new AppError(409, `${d.name}'s OPD has ended for today`, 'OPD_CLOSED');
        }

        // Department-wide daily limit (from the Departments screen)
        if (d.department_id) {
            await c.query('SELECT id FROM departments WHERE id = $1 FOR UPDATE', [d.department_id]);
            if (d.dep_limit) {
                const cnt = await c.query('SELECT COUNT(*)::int AS n FROM tokens WHERE department_id = $1 AND booking_date = $2', [d.department_id, day]);
                if (cnt.rows[0].n >= d.dep_limit) throw new AppError(409, 'This department has reached its daily token limit', 'DEPARTMENT_LIMIT_REACHED');
            }
        }

        // Who is the token for?
        let patientName = user.name, patientAge = null, relation = 'self', familyId = null;
        if (family_member_id) {
            const f = await c.query('SELECT * FROM family_members WHERE id = $1 AND user_id = $2', [family_member_id, userId]);
            if (!f.rows[0]) throw new AppError(404, 'Family member not found');
            patientName = f.rows[0].name; patientAge = f.rows[0].age; relation = f.rows[0].relation || 'family'; familyId = f.rows[0].id;
        }

        // Atomic token number + doctor's daily limit
        const limit = d.daily_token_limit || 40;
        const num = await c.query(
            `INSERT INTO token_counters (doctor_id, counter_date, last_number) VALUES ($1, $2, 1)
             ON CONFLICT (doctor_id, counter_date)
             DO UPDATE SET last_number = token_counters.last_number + 1 WHERE token_counters.last_number < $3
             RETURNING last_number`, [d.id, day, limit]);
        if (!num.rowCount) throw new AppError(409, `Daily token limit reached for ${d.name}`, 'DAILY_LIMIT_REACHED');

        try {
            const ins = await c.query(
                `INSERT INTO tokens (token_number, patient_id, doctor_id, hospital_id, department_id, patient_name, patient_age, relation,
                                     family_member_id, booking_date, priority_category, priority_status, notes)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
                [num.rows[0].last_number, userId, d.id, d.hospital_id, d.department_id, patientName, patientAge, relation,
                 familyId, day, priority_category || null, priority_category ? 'requested' : 'none', notes || null]);
            return ins.rows[0].id;
        } catch (err) {
            if (err.code === '23505') throw new AppError(409, `${patientName} already has an active token with ${d.name} on ${day}`, 'ALREADY_BOOKED');
            throw err;
        }
    });

    const t = await getToken(tokenId);
    await notifyUser(userId, templates.booked(t));
    await refreshQueue(t.doctor_id, t.booking_date);
    return getLiveToken(tokenId);
}

// Position, estimate, now-serving and an anonymised mini queue for the "My Token" screen
async function liveView(t) {
    const { rows } = await pool.query(
        `SELECT id, token_number, status, priority FROM tokens WHERE doctor_id = $1 AND booking_date = $2 AND status IN ('waiting','serving')`,
        [t.doctor_id, t.booking_date]);
    const serving = rows.find((r) => r.status === 'serving');
    const waiting = sortWaiting(rows.filter((r) => r.status === 'waiting'));
    const idx = waiting.findIndex((r) => r.id === t.id);

    const queue = [];
    if (serving) queue.push({ token_number: serving.token_number, status: 'serving', is_you: serving.id === t.id });
    waiting.slice(0, 3).forEach((r) => queue.push({ token_number: r.token_number, status: 'waiting', is_you: r.id === t.id }));
    if (idx >= 3) queue.push({ token_number: t.token_number, status: 'waiting', is_you: true });

    return {
        now_serving: serving ? serving.token_number : null,
        ahead_count: t.status === 'waiting' ? idx : t.status === 'serving' ? 0 : null,
        eta_minutes: t.eta_minutes,
        waiting_count: waiting.length,
        queue,
    };
}

async function getLiveToken(tokenId) {
    const t = await getToken(tokenId);
    if (!t) throw new AppError(404, 'Token not found');
    return { ...t, live: await liveView(t) };
}

async function getTokenFor(userId, role, tokenId) {
    const t = await getToken(tokenId);
    let allowed = t && (t.patient_id === userId || role === 'admin');
    if (t && !allowed && role === 'manager') {
        const h = await pool.query('SELECT 1 FROM hospitals WHERE id = $1 AND manager_id = $2', [t.hospital_id, userId]);
        allowed = h.rowCount > 0;
    }
    if (!allowed) throw new AppError(404, 'Token not found');
    return { ...t, live: await liveView(t) };
}

async function listMine(userId, scope, limit = 50) {
    const active = scope !== 'history';
    const { rows } = await pool.query(
        `${TOKEN_JOIN} WHERE t.patient_id = $1 AND t.status ${active ? `IN ('waiting','serving')` : `IN ('done','skipped','cancelled')`}
          ORDER BY ${active ? 't.booking_date, t.token_number' : 't.created_at DESC'} LIMIT $2`,
        [userId, limit]);
    return rows;
}

// Patient cancels their own waiting token
async function cancelOwn(userId, tokenId) {
    const { rows } = await pool.query(
        `UPDATE tokens SET status = 'cancelled', cancelled_at = NOW(), ahead_count = NULL, eta_minutes = NULL, updated_at = NOW()
          WHERE id = $1 AND patient_id = $2 AND status = 'waiting' RETURNING *`, [tokenId, userId]);
    if (!rows[0]) {
        const e = await pool.query('SELECT status FROM tokens WHERE id = $1 AND patient_id = $2', [tokenId, userId]);
        if (!e.rows[0]) throw new AppError(404, 'Token not found');
        throw new AppError(409, `A ${e.rows[0].status} token cannot be cancelled`, 'INVALID_STATE');
    }
    emitTokenUpdate(rows[0]);
    const full = await getToken(tokenId);
    await notifyUser(userId, templates.cancelled(full));
    await refreshQueue(full.doctor_id, full.booking_date);
    return full;
}

// Housekeeping (run every few minutes): tokens from past days that were never processed are closed
async function expireStaleTokens() {
    const r = await pool.query(
        `UPDATE tokens SET
            status = CASE WHEN status = 'serving' THEN 'done' ELSE 'skipped' END,
            completed_at = CASE WHEN status = 'serving' THEN NOW() ELSE completed_at END,
            skipped_at = CASE WHEN status = 'waiting' THEN NOW() ELSE skipped_at END,
            ahead_count = NULL, eta_minutes = NULL, updated_at = NOW()
          WHERE booking_date < $1 AND status IN ('waiting','serving')`, [todayStr()]);
    return r.rowCount;
}

module.exports = { bookToken, getLiveToken, getTokenFor, listMine, cancelOwn, expireStaleTokens };
