const pool = require('../config/db');
const { AppError, needId } = require('../utils/http');
const { DAYS, todayStr, isDateStr, isHM, parseHM, weekday } = require('../utils/dates');

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// validates + normalises schedule fields; returns only the keys that were provided
function parseSchedule(b) {
    const out = {};
    if (b.schedule_days !== undefined) {
        if (!Array.isArray(b.schedule_days) || !b.schedule_days.length || !b.schedule_days.every((d) => DAYS.includes(d))) {
            throw new AppError(400, 'schedule_days must be a non-empty array of Mon, Tue, Wed, Thu, Fri, Sat, Sun');
        }
        out.schedule_days = DAY_ORDER.filter((d) => b.schedule_days.includes(d));
    }
    for (const k of ['schedule_from', 'schedule_to']) {
        if (b[k] !== undefined) {
            if (!isHM(b[k])) throw new AppError(400, `${k} must be 24h HH:MM`);
            out[k] = b[k];
        }
    }
    if (out.schedule_from && out.schedule_to && parseHM(out.schedule_from) >= parseHM(out.schedule_to)) {
        throw new AppError(400, 'schedule_to must be after schedule_from');
    }
    return out;
}

function parseLimit(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 500) throw new AppError(400, 'daily_token_limit must be a number between 1 and 500');
    return n;
}

async function checkDepartment(hospitalId, departmentId) {
    const r = await pool.query('SELECT id FROM departments WHERE id = $1 AND hospital_id = $2', [departmentId, hospitalId]);
    if (!r.rows[0]) throw new AppError(400, 'department_id does not belong to your hospital');
}

// GET /api/doctors?department_id=&search=   (manager's own hospital)
const listMyDoctors = async (req, res) => {
    const params = [req.hospital.id, todayStr()];
    let extra = '';
    if (req.query.department_id) { params.push(parseInt(req.query.department_id, 10) || 0); extra += ` AND d.department_id = $${params.length}`; }
    if (req.query.search) { params.push(`%${req.query.search}%`); extra += ` AND (d.name ILIKE $${params.length} OR d.specialization ILIKE $${params.length})`; }
    const { rows } = await pool.query(
        `SELECT d.*, dep.name AS department_name, COALESCE(c.last_number, 0)::int AS tokens_issued_today
           FROM doctors d
           LEFT JOIN departments dep ON dep.id = d.department_id
           LEFT JOIN token_counters c ON c.doctor_id = d.id AND c.counter_date = $2::date
          WHERE d.hospital_id = $1 ${extra} ORDER BY dep.name NULLS LAST, d.name`, params);
    res.json({ success: true, doctors: rows });
};

// POST /api/doctors
const createDoctor = async (req, res) => {
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) throw new AppError(400, 'Doctor name is required');
    if (!b.department_id) throw new AppError(400, 'department_id is required');
    await checkDepartment(req.hospital.id, b.department_id);

    const sched = parseSchedule(b);
    const { rows } = await pool.query(
        `INSERT INTO doctors (hospital_id, department_id, name, specialization, qualification, experience_years, photo_url,
                              avg_consult_minutes, is_available, schedule_days, schedule_from, schedule_to, daily_token_limit, room)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                 COALESCE($10::text[], ARRAY['Mon','Tue','Wed','Thu','Fri','Sat']), COALESCE($11,'09:00'), COALESCE($12,'17:00'), $13, $14)
         RETURNING *`,
        [req.hospital.id, b.department_id, String(b.name).trim(), b.specialization || null, b.qualification || null,
         b.experience_years != null ? parseInt(b.experience_years, 10) : null, b.photo_url || null,
         b.avg_consult_minutes != null ? Number(b.avg_consult_minutes) : 10, b.is_available !== undefined ? Boolean(b.is_available) : true,
         sched.schedule_days || null, sched.schedule_from || null, sched.schedule_to || null,
         b.daily_token_limit != null ? parseLimit(b.daily_token_limit) : 40, b.room || null]);
    res.status(201).json({ success: true, message: 'Doctor added successfully', doctor: rows[0] });
};

// PUT /api/doctors/:id
const updateDoctor = async (req, res) => {
    const id = needId(req.params.id, 'doctor id');
    const b = req.body || {};
    if (b.department_id) await checkDepartment(req.hospital.id, b.department_id);
    const sched = parseSchedule(b);
    const { rows } = await pool.query(
        `UPDATE doctors SET
            department_id = COALESCE($1, department_id), name = COALESCE($2, name), specialization = COALESCE($3, specialization),
            qualification = COALESCE($4, qualification), experience_years = COALESCE($5, experience_years), photo_url = COALESCE($6, photo_url),
            avg_consult_minutes = COALESCE($7, avg_consult_minutes), is_available = COALESCE($8, is_available),
            schedule_days = COALESCE($9::text[], schedule_days), schedule_from = COALESCE($10, schedule_from), schedule_to = COALESCE($11, schedule_to),
            daily_token_limit = COALESCE($12, daily_token_limit), room = COALESCE($13, room), updated_at = NOW()
          WHERE id = $14 AND hospital_id = $15 RETURNING *`,
        [b.department_id || null, b.name ? String(b.name).trim() : null, b.specialization ?? null, b.qualification ?? null,
         b.experience_years != null ? parseInt(b.experience_years, 10) : null, b.photo_url ?? null,
         b.avg_consult_minutes != null ? Number(b.avg_consult_minutes) : null, b.is_available !== undefined ? Boolean(b.is_available) : null,
         sched.schedule_days || null, sched.schedule_from || null, sched.schedule_to || null,
         b.daily_token_limit != null ? parseLimit(b.daily_token_limit) : null, b.room ?? null, id, req.hospital.id]);
    if (!rows[0]) throw new AppError(404, 'Doctor not found');
    res.json({ success: true, message: 'Doctor updated successfully', doctor: rows[0] });
};

// PATCH /api/doctors/:id/toggle   (show / hide a doctor without deleting history)
const toggleDoctor = async (req, res) => {
    const id = needId(req.params.id, 'doctor id');
    const { rows } = await pool.query(
        `UPDATE doctors SET is_available = COALESCE($1, NOT is_available), updated_at = NOW() WHERE id = $2 AND hospital_id = $3 RETURNING *`,
        [req.body && req.body.is_available !== undefined ? Boolean(req.body.is_available) : null, id, req.hospital.id]);
    if (!rows[0]) throw new AppError(404, 'Doctor not found');
    res.json({ success: true, message: 'Doctor availability updated', doctor: rows[0] });
};

// DELETE /api/doctors/:id
const deleteDoctor = async (req, res) => {
    const id = needId(req.params.id, 'doctor id');
    try {
        const { rows } = await pool.query('DELETE FROM doctors WHERE id = $1 AND hospital_id = $2 RETURNING id', [id, req.hospital.id]);
        if (!rows[0]) throw new AppError(404, 'Doctor not found');
    } catch (err) {
        if (err.code === '23503') throw new AppError(409, 'This doctor has token history and cannot be deleted. Hide the doctor instead (PATCH /api/doctors/:id/toggle).', 'HAS_HISTORY');
        throw err;
    }
    res.json({ success: true, message: 'Doctor deleted successfully' });
};

// GET /api/doctors/:id?date=   (any logged-in user, approved hospitals only) - doctor + availability + queue summary
const getDoctor = async (req, res) => {
    const id = needId(req.params.id, 'doctor id');
    const date = isDateStr(req.query.date) ? req.query.date : todayStr();
    const { rows } = await pool.query(
        `SELECT d.*, dep.name AS department_name, h.name AS hospital_name, h.address AS hospital_address, h.city AS hospital_city,
                h.status AS hospital_status, h.manager_id, COALESCE(c.last_number, 0)::int AS tokens_issued
           FROM doctors d JOIN hospitals h ON h.id = d.hospital_id
           LEFT JOIN departments dep ON dep.id = d.department_id
           LEFT JOIN token_counters c ON c.doctor_id = d.id AND c.counter_date = $2::date
          WHERE d.id = $1`, [id, date]);
    const d = rows[0];
    if (!d || (d.hospital_status !== 'approved' && d.manager_id !== req.userId && req.userRole !== 'admin')) throw new AppError(404, 'Doctor not found');

    const q = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting, MAX(token_number) FILTER (WHERE status = 'serving') AS now_serving
           FROM tokens WHERE doctor_id = $1 AND booking_date = $2`, [id, date]);
    const avg = d.avg_consult_minutes || 10;
    const { manager_id, hospital_status, ...doctor } = d;
    res.json({
        success: true,
        doctor: { ...doctor, tokens_left: Math.max(0, d.daily_token_limit - d.tokens_issued) },
        works_on_date: (d.schedule_days || []).includes(weekday(date)),
        queue: { date, now_serving: q.rows[0].now_serving, waiting: q.rows[0].waiting, estimated_wait_if_booked_now: Math.round(q.rows[0].waiting * avg) },
    });
};

module.exports = { listMyDoctors, createDoctor, updateDoctor, toggleDoctor, deleteDoctor, getDoctor };
