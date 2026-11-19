// Patient-facing browsing: approved hospitals -> departments -> doctors
const pool = require('../config/db');
const { AppError, needId } = require('../utils/http');
const { todayStr, isDateStr } = require('../utils/dates');

// Fields a patient may see (no manager contact details or documents)
const PUBLIC_COLS = `h.id, h.name, h.hospital_type, h.address, h.city, h.phone, h.opd_timings, h.logo_url, h.status, h.latitude, h.longitude`;

// GET /api/hospitals?search=&city=&lat=&lng=&page=&limit=
const listHospitals = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = (req.query.search || '').trim();
    const city = (req.query.city || '').trim();
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    const params = [];
    const where = [`h.status = 'approved'`];
    if (search) { params.push(`%${search}%`); where.push(`(h.name ILIKE $${params.length} OR h.city ILIKE $${params.length} OR h.address ILIKE $${params.length})`); }
    if (city) { params.push(city); where.push(`LOWER(h.city) = LOWER($${params.length})`); }

    // optional "nearest first" using the hospital's latitude / longitude (haversine, km)
    let distance = 'NULL::float8';
    let order = 'h.name';
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        params.push(lat, lng);
        const a = params.length - 1, b = params.length;
        distance = `(6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(h.latitude::float8 - $${a}::float8) / 2), 2)
                    + COS(RADIANS($${a}::float8)) * COS(RADIANS(h.latitude::float8)) * POWER(SIN(RADIANS(h.longitude::float8 - $${b}::float8) / 2), 2))))`;
        order = 'distance_km ASC NULLS LAST, h.name';
    }
    params.push(limit, (page - 1) * limit);

    const { rows } = await pool.query(
        `SELECT ${PUBLIC_COLS}, ${distance} AS distance_km,
                (SELECT COUNT(*)::int FROM doctors d WHERE d.hospital_id = h.id AND d.is_available) AS doctor_count,
                COUNT(*) OVER()::int AS total
           FROM hospitals h WHERE ${where.join(' AND ')}
          ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);

    res.json({ success: true, hospitals: rows.map(({ total, ...r }) => r), page, limit, total: rows[0] ? rows[0].total : 0 });
};

// GET /api/hospitals/cities
const listCities = async (req, res) => {
    const { rows } = await pool.query(`SELECT DISTINCT city FROM hospitals WHERE status = 'approved' AND city IS NOT NULL ORDER BY city`);
    res.json({ success: true, cities: rows.map((r) => r.city) });
};

async function visibleHospital(req) {
    const id = needId(req.params.id, 'hospital id');
    const { rows } = await pool.query(`SELECT h.* FROM hospitals h WHERE h.id = $1`, [id]);
    const hos = rows[0];
    const staff = hos && (req.userRole === 'admin' || hos.manager_id === req.userId);
    if (!hos || (hos.status !== 'approved' && !staff)) throw new AppError(404, 'Hospital not found');
    return { hos, staff };
}

// GET /api/hospitals/:id
const getHospital = async (req, res) => {
    const { hos, staff } = await visibleHospital(req);
    if (staff) return res.json({ success: true, hospital: hos });
    const { rows } = await pool.query(`SELECT ${PUBLIC_COLS} FROM hospitals h WHERE h.id = $1`, [hos.id]);
    res.json({ success: true, hospital: rows[0] });
};

// GET /api/hospitals/:id/departments
const listHospitalDepartments = async (req, res) => {
    const { hos } = await visibleHospital(req);
    const { rows } = await pool.query(
        `SELECT dep.id, dep.name, dep.description, dep.icon_key,
                (SELECT COUNT(*)::int FROM doctors d WHERE d.department_id = dep.id AND d.is_available) AS doctor_count
           FROM departments dep WHERE dep.hospital_id = $1 AND dep.is_active ORDER BY dep.name`, [hos.id]);
    res.json({ success: true, departments: rows });
};

// GET /api/hospitals/:id/doctors?department_id=&search=&date=
const listHospitalDoctors = async (req, res) => {
    const { hos } = await visibleHospital(req);
    const date = isDateStr(req.query.date) ? req.query.date : todayStr();
    const params = [hos.id, date];
    let extra = '';
    if (req.query.department_id) { params.push(parseInt(req.query.department_id, 10) || 0); extra += ` AND d.department_id = $${params.length}`; }
    if (req.query.search) { params.push(`%${req.query.search}%`); extra += ` AND (d.name ILIKE $${params.length} OR d.specialization ILIKE $${params.length})`; }

    const { rows } = await pool.query(
        `SELECT d.id, d.hospital_id, d.department_id, dep.name AS department_name, d.name, d.specialization, d.qualification,
                d.experience_years, d.photo_url, d.avg_consult_minutes, d.schedule_days, d.schedule_from, d.schedule_to,
                d.room, d.daily_token_limit, COALESCE(c.last_number, 0)::int AS tokens_issued,
                GREATEST(d.daily_token_limit - COALESCE(c.last_number, 0), 0)::int AS tokens_left, $2::date::text AS availability_date
           FROM doctors d
           LEFT JOIN departments dep ON dep.id = d.department_id
           LEFT JOIN token_counters c ON c.doctor_id = d.id AND c.counter_date = $2::date
          WHERE d.hospital_id = $1 AND d.is_available AND COALESCE(dep.is_active, true) ${extra}
          ORDER BY d.name`, params);
    res.json({ success: true, doctors: rows });
};

module.exports = { listHospitals, listCities, getHospital, listHospitalDepartments, listHospitalDoctors };
