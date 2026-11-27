const pool = require('../config/db');
const { tx } = require('../utils/db');
const { AppError } = require('../utils/http');
const { sortWaiting, estimateWait, nextAverage } = require('../utils/queue');
const { notifyUser, templates } = require('./notify');
const { emitToUser, emitToRoom } = require('./realtime');

const NOTIFY_AHEAD = () => Number(process.env.NOTIFY_WHEN_AHEAD) || 2;
const DEFAULT_AVG = () => Number(process.env.DEFAULT_CONSULT_MINUTES) || 10;

// A token row joined with doctor / hospital / department names (used in API responses + notification text)
const TOKEN_JOIN = `
    SELECT t.*, d.name AS doctor_name, d.room, d.qualification, d.specialization,
           COALESCE(d.schedule_from || ' - ' || d.schedule_to, '09:00 - 17:00') AS availability_hours,
           h.name AS hospital_name, dep.name AS department_name,
           u.phone AS account_phone
      FROM tokens t
      JOIN doctors d ON d.id = t.doctor_id
      JOIN hospitals h ON h.id = t.hospital_id
      LEFT JOIN departments dep ON dep.id = t.department_id
      LEFT JOIN users u ON u.id = t.patient_id`;

async function getToken(id, db = pool) {
    const { rows } = await db.query(`${TOKEN_JOIN} WHERE t.id = $1`, [id]);
    return rows[0] || null;
}

const emitTokenUpdate = (t) =>
    emitToUser(t.patient_id, 'token.updated', {
        id: t.id, token_number: t.token_number, status: t.status, ahead_count: t.ahead_count,
        eta_minutes: t.eta_minutes, priority: t.priority, doctor_id: t.doctor_id, booking_date: t.booking_date,
    });

async function recordDuration(doctorId, startedAt, completedAt) {
    if (!startedAt || !completedAt) return;
    const mins = (new Date(completedAt) - new Date(startedAt)) / 60000;
    const { rows } = await pool.query('SELECT avg_consult_minutes FROM doctors WHERE id = $1', [doctorId]);
    if (!rows[0]) return;
    await pool.query('UPDATE doctors SET avg_consult_minutes = $2, updated_at = NOW() WHERE id = $1', [doctorId, nextAverage(rows[0].avg_consult_minutes, mins)]);
}

/**
 * Recompute position + wait estimate for every waiting token of a doctor/day, store it on the token,
 * push it live over WebSocket, and send the "your turn is near" notification once per token.
 * Call after ANY change to a queue.
 */
async function refreshQueue(doctorId, date) {
    const d = await pool.query('SELECT avg_consult_minutes FROM doctors WHERE id = $1', [doctorId]);
    if (!d.rows[0]) return;
    const avg = d.rows[0].avg_consult_minutes || DEFAULT_AVG();

    const { rows } = await pool.query(
        `SELECT * FROM tokens WHERE doctor_id = $1 AND booking_date = $2 AND status IN ('waiting','serving')`,
        [doctorId, date]
    );
    const waiting = sortWaiting(rows.filter((t) => t.status === 'waiting'));
    const serving = rows.find((t) => t.status === 'serving');

    const changed = [];
    const notices = [];
    waiting.forEach((t, i) => {
        const eta = estimateWait(i, avg);
        const isNear = i > 0 && i <= NOTIFY_AHEAD() && !t.near_notified;
        if (t.ahead_count !== i || t.eta_minutes !== eta || isNear) changed.push({ row: t, ahead: i, eta, near: t.near_notified || isNear });
        if (isNear) notices.push({ id: t.id, ahead: i });
    });
    if (serving && (serving.ahead_count !== 0 || serving.eta_minutes !== 0)) changed.push({ row: serving, ahead: 0, eta: 0, near: serving.near_notified });

    if (changed.length) {
        await pool.query(
            `UPDATE tokens t SET ahead_count = v.ahead, eta_minutes = v.eta, near_notified = v.near, updated_at = NOW()
               FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS ahead, unnest($3::int[]) AS eta, unnest($4::boolean[]) AS near) v
              WHERE t.id = v.id`,
            [changed.map((c) => c.row.id), changed.map((c) => c.ahead), changed.map((c) => c.eta), changed.map((c) => c.near)]
        );
        changed.forEach((c) => emitTokenUpdate({ ...c.row, ahead_count: c.ahead, eta_minutes: c.eta }));
    }

    emitToRoom(doctorId, date, 'queue.updated', {
        doctor_id: doctorId, date, now_serving: serving ? serving.token_number : null, waiting_count: waiting.length,
    });

    for (const n of notices) {
        const t = await getToken(n.id);
        if (t) await notifyUser(t.patient_id, templates.near(t, n.ahead));
    }
}

async function loadDoctorOfHospital(doctorId, hospitalId) {
    const { rows } = await pool.query(
        `SELECT d.*, dep.name AS department_name
           FROM doctors d
           LEFT JOIN departments dep ON dep.id = d.department_id
          WHERE d.id = $1 AND d.hospital_id = $2`, [doctorId, hospitalId]);
    if (!rows[0]) throw new AppError(404, 'Doctor not found in your hospital');
    return rows[0];
}

async function loadHospitalToken(tokenId, hospitalId) {
    const { rows } = await pool.query('SELECT * FROM tokens WHERE id = $1 AND hospital_id = $2', [tokenId, hospitalId]);
    if (!rows[0]) throw new AppError(404, 'Token not found in your hospital');
    return rows[0];
}

// Manager's view of one doctor's queue for a day
async function getOverview(hospitalId, doctorId, date) {
    const doctor = await loadDoctorOfHospital(doctorId, hospitalId);
    const { rows } = await pool.query(
        `SELECT t.*, u.phone AS account_phone, d.name AS doctor_name, d.room, d.qualification,
                dep.name AS department_name,
                COALESCE(d.schedule_from || ' - ' || d.schedule_to, '09:00 - 17:00') AS availability_hours
           FROM tokens t
           JOIN users u ON u.id = t.patient_id
           JOIN doctors d ON d.id = t.doctor_id
           LEFT JOIN departments dep ON dep.id = t.department_id
          WHERE t.doctor_id = $1 AND t.booking_date = $2 ORDER BY t.token_number`,
        [doctorId, date]
    );
    const count = (s) => rows.filter((t) => t.status === s).length;
    return {
        doctor_id: doctorId,
        doctor_name: doctor.name,
        qualification: doctor.qualification,
        specialization: doctor.specialization,
        department_name: doctor.department_name,
        room: doctor.room,
        availability_hours: doctor.schedule_from && doctor.schedule_to ? `${doctor.schedule_from} - ${doctor.schedule_to}` : '09:00 - 17:00',
        schedule_days: doctor.schedule_days,
        date,
        avg_consult_minutes: doctor.avg_consult_minutes,
        now_serving: rows.find((t) => t.status === 'serving') || null,
        waiting: sortWaiting(rows.filter((t) => t.status === 'waiting')),
        skipped: rows.filter((t) => t.status === 'skipped'),
        counts: { total: rows.length, waiting: count('waiting'), serving: count('serving'), done: count('done'), skipped: count('skipped'), cancelled: count('cancelled') },
    };
}

// "Call Next": finishes whoever is being served, then starts the next waiting patient (priority first)
async function callNext(hospitalId, doctorId, date) {
    await loadDoctorOfHospital(doctorId, hospitalId);

    const { nextId, finished } = await tx(async (c) => {
        const { rows } = await c.query(
            `SELECT * FROM tokens WHERE doctor_id = $1 AND booking_date = $2 AND status IN ('waiting','serving')
              ORDER BY token_number FOR UPDATE`,
            [doctorId, date]
        );
        const waiting = sortWaiting(rows.filter((t) => t.status === 'waiting'));
        if (!waiting.length) throw new AppError(409, 'No patients waiting in the queue', 'QUEUE_EMPTY');

        const done = [];
        for (const s of rows.filter((t) => t.status === 'serving')) {
            const r = await c.query(`UPDATE tokens SET status = 'done', completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`, [s.id]);
            done.push(r.rows[0]);
        }
        await c.query(
            `UPDATE tokens SET status = 'serving', started_at = NOW(), called_at = NOW(), ahead_count = 0, eta_minutes = 0,
                    near_notified = true, updated_at = NOW() WHERE id = $1`,
            [waiting[0].id]
        );
        return { nextId: waiting[0].id, finished: done };
    });

    for (const f of finished) {
        await recordDuration(doctorId, f.started_at, f.completed_at);
        emitTokenUpdate(f);
    }
    const next = await getToken(nextId);
    emitTokenUpdate(next);
    await notifyUser(next.patient_id, templates.called(next));
    await refreshQueue(doctorId, date);
    return { token: next, completed: finished };
}

async function complete(hospitalId, tokenId) {
    const t = await loadHospitalToken(tokenId, hospitalId);
    const { rows } = await pool.query(`UPDATE tokens SET status = 'done', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'serving' RETURNING *`, [tokenId]);
    if (!rows[0]) throw new AppError(409, 'Token is not currently being served', 'INVALID_STATE');
    await recordDuration(t.doctor_id, rows[0].started_at, rows[0].completed_at);
    emitTokenUpdate(rows[0]);
    await refreshQueue(t.doctor_id, t.booking_date);
    return getToken(tokenId);
}

// Complete whichever token is currently being served for a doctor
async function completeCurrent(hospitalId, doctorId, date) {
    await loadDoctorOfHospital(doctorId, hospitalId);
    const { rows } = await pool.query(
        `SELECT id FROM tokens WHERE doctor_id = $1 AND booking_date = $2 AND status = 'serving' LIMIT 1`,
        [doctorId, date]
    );
    if (!rows[0]) throw new AppError(404, 'No patient is currently being served for this doctor', 'NOT_SERVING');
    return complete(hospitalId, rows[0].id);
}

async function skip(hospitalId, tokenId) {
    const t = await loadHospitalToken(tokenId, hospitalId);
    const { rows } = await pool.query(
        `UPDATE tokens SET status = 'skipped', skipped_at = NOW(), ahead_count = NULL, eta_minutes = NULL, updated_at = NOW()
          WHERE id = $1 AND status IN ('waiting','serving') RETURNING *`, [tokenId]);
    if (!rows[0]) throw new AppError(409, 'Only waiting or serving tokens can be skipped', 'INVALID_STATE');
    emitTokenUpdate(rows[0]);
    const full = await getToken(tokenId);
    await notifyUser(full.patient_id, templates.skipped(full));
    await refreshQueue(t.doctor_id, t.booking_date);
    return full;
}

// Put a skipped (no-show) patient back with their original token number
async function recall(hospitalId, tokenId) {
    const t = await loadHospitalToken(tokenId, hospitalId);
    const { rows } = await pool.query(
        `UPDATE tokens SET status = 'waiting', skipped_at = NULL, near_notified = false, updated_at = NOW()
          WHERE id = $1 AND status = 'skipped' RETURNING *`, [tokenId]);
    if (!rows[0]) throw new AppError(409, 'Only skipped tokens can be recalled', 'INVALID_STATE');
    emitTokenUpdate(rows[0]);
    await refreshQueue(t.doctor_id, t.booking_date);
    return getToken(tokenId);
}

// Approve / reject priority (elderly, disabled, pregnant, urgent). Approved tokens jump the queue.
async function setPriority(hospitalId, tokenId, approved) {
    const t = await loadHospitalToken(tokenId, hospitalId);
    const { rows } = await pool.query(
        `UPDATE tokens SET priority = $2, priority_status = $3, updated_at = NOW() WHERE id = $1 AND status = 'waiting' RETURNING *`,
        [tokenId, approved ? 1 : 0, approved ? 'approved' : 'rejected']);
    if (!rows[0]) throw new AppError(409, 'Priority can only be changed on waiting tokens', 'INVALID_STATE');
    emitTokenUpdate(rows[0]);
    const full = await getToken(tokenId);
    await notifyUser(full.patient_id, templates.priority(full, approved));
    await refreshQueue(t.doctor_id, t.booking_date);
    return full;
}

// Manager cancels a waiting / skipped token (e.g. patient left)
async function managerCancel(hospitalId, tokenId) {
    const t = await loadHospitalToken(tokenId, hospitalId);
    const { rows } = await pool.query(
        `UPDATE tokens SET status = 'cancelled', cancelled_at = NOW(), ahead_count = NULL, eta_minutes = NULL, updated_at = NOW()
          WHERE id = $1 AND status IN ('waiting','skipped') RETURNING *`, [tokenId]);
    if (!rows[0]) throw new AppError(409, 'Only waiting or skipped tokens can be cancelled', 'INVALID_STATE');
    emitTokenUpdate(rows[0]);
    const full = await getToken(tokenId);
    await notifyUser(full.patient_id, templates.cancelled(full));
    await refreshQueue(t.doctor_id, t.booking_date);
    return full;
}

module.exports = { TOKEN_JOIN, getToken, emitTokenUpdate, refreshQueue, getOverview, callNext, complete, completeCurrent, skip, recall, setPriority, managerCancel };
