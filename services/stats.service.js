const pool = require('../config/db');

// Manager dashboard: today's numbers for one hospital
async function managerStats(hospitalId, date) {
    const by = await pool.query('SELECT status, COUNT(*)::int AS n FROM tokens WHERE hospital_id = $1 AND booking_date = $2 GROUP BY status', [hospitalId, date]);
    const counts = { waiting: 0, serving: 0, done: 0, skipped: 0, cancelled: 0 };
    by.rows.forEach((r) => { counts[r.status] = r.n; });

    const avg = await pool.query(
        `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)::numeric, 1) AS m
           FROM tokens WHERE hospital_id = $1 AND booking_date = $2 AND status = 'done' AND started_at IS NOT NULL`, [hospitalId, date]);

    const doctors = await pool.query(
        `SELECT d.id, d.name, d.room, d.daily_token_limit, dep.name AS department_name,
                COALESCE(c.last_number, 0)::int AS issued,
                (SELECT token_number FROM tokens WHERE doctor_id = d.id AND booking_date = $2 AND status = 'serving' LIMIT 1) AS now_serving,
                (SELECT COUNT(*)::int FROM tokens WHERE doctor_id = d.id AND booking_date = $2 AND status = 'waiting') AS waiting
           FROM doctors d
           LEFT JOIN departments dep ON dep.id = d.department_id
           LEFT JOIN token_counters c ON c.doctor_id = d.id AND c.counter_date = $2
          WHERE d.hospital_id = $1 AND d.is_available
          ORDER BY dep.name, d.name`, [hospitalId, date]);

    // tokens per hour (for the dashboard chart)
    const hourly = await pool.query(
        `SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE $3)::int AS hour, COUNT(*)::int AS n
           FROM tokens WHERE hospital_id = $1 AND booking_date = $2 GROUP BY 1 ORDER BY 1`, [hospitalId, date, process.env.APP_TIMEZONE || 'Asia/Karachi']);

    return {
        date,
        tokens_issued: Object.values(counts).reduce((a, b) => a + b, 0),
        in_queue: counts.waiting + counts.serving,
        served: counts.done,
        avg_consult_minutes: avg.rows[0].m,
        counts,
        doctors: doctors.rows,
        tokens_by_hour: hourly.rows,
    };
}

// Admin "Platform stats"
async function adminStats(date) {
    const [hospitals, tokens, queues, patients, per, hourly] = await Promise.all([
        pool.query('SELECT status, COUNT(*)::int AS n FROM hospitals GROUP BY status'),
        pool.query('SELECT COUNT(*)::int AS n FROM tokens WHERE booking_date = $1', [date]),
        pool.query(`SELECT COUNT(DISTINCT doctor_id)::int AS n FROM tokens WHERE booking_date = $1 AND status IN ('waiting','serving')`, [date]),
        pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'patient'`),
        pool.query(
            `SELECT h.id, h.name, COUNT(t.id)::int AS tokens
               FROM hospitals h LEFT JOIN tokens t ON t.hospital_id = h.id AND t.booking_date = $1
              WHERE h.status = 'approved' GROUP BY h.id ORDER BY tokens DESC, h.name LIMIT 10`, [date]),
        pool.query(
            `SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE $2)::int AS hour, COUNT(*)::int AS n
               FROM tokens WHERE booking_date = $1 GROUP BY 1 ORDER BY 1`, [date, process.env.APP_TIMEZONE || 'Asia/Karachi']),
    ]);
    const by = { pending: 0, approved: 0, rejected: 0, suspended: 0 };
    hospitals.rows.forEach((r) => { by[r.status] = r.n; });
    return {
        date,
        hospitals: { total: Object.values(by).reduce((a, b) => a + b, 0), ...by },
        tokens_today: tokens.rows[0].n,
        active_queues: queues.rows[0].n,
        patients: patients.rows[0].n,
        tokens_per_hospital: per.rows,
        tokens_by_hour: hourly.rows,
    };
}

module.exports = { managerStats, adminStats };
