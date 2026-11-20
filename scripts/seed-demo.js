// Demo data for the MVP walkthrough: 1 admin, 2 managers, 1 patient, 2 approved hospitals with departments + doctors.
//   node scripts/seed-demo.js           (password for every demo account: Password123)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const PASSWORD = 'Password123';

async function user(name, email, role, hash) {
    const r = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, is_verified) VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING id`, [name, email, hash, role]);
    return r.rows[0].id;
}

async function hospital(managerId, h) {
    const ex = await pool.query('SELECT id FROM hospitals WHERE manager_id = $1', [managerId]);
    let id;
    if (ex.rows[0]) id = ex.rows[0].id;
    else {
        const r = await pool.query(
            `INSERT INTO hospitals (name, hospital_type, address, city, phone, email, opd_timings, status, manager_id, manager_name, manager_email,
                                    manager_phone, manager_designation, latitude, longitude)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'approved',$8,$9,$10,$11,'Medical Superintendent',$12,$13) RETURNING id`,
            [h.name, h.type, h.address, h.city, h.phone, h.email, '9:00 AM - 8:00 PM', managerId, h.manager, h.email, h.phone, h.lat, h.lng]);
        id = r.rows[0].id;
        await pool.query('UPDATE users SET hospital_id = $1 WHERE id = $2', [id, managerId]);
    }
    for (const d of h.departments) {
        let dep = await pool.query('SELECT id FROM departments WHERE hospital_id = $1 AND name = $2', [id, d.name]);
        if (!dep.rows[0]) {
            dep = await pool.query(
                'INSERT INTO departments (hospital_id, name, description, daily_token_limit, icon_key) VALUES ($1,$2,$3,$4,$5) RETURNING id',
                [id, d.name, d.description, d.limit, d.icon]);
        }
        for (const doc of d.doctors) {
            const e = await pool.query('SELECT id FROM doctors WHERE hospital_id = $1 AND name = $2', [id, doc.name]);
            if (e.rows[0]) continue;
            await pool.query(
                `INSERT INTO doctors (hospital_id, department_id, name, specialization, qualification, experience_years, schedule_days,
                                      schedule_from, schedule_to, daily_token_limit, room)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [id, dep.rows[0].id, doc.name, doc.spec, doc.qual, doc.years, doc.days, doc.from, doc.to, doc.limit, doc.room]);
        }
    }
    return id;
}

(async () => {
    try {
        const hash = await bcrypt.hash(PASSWORD, await bcrypt.genSalt(10));
        await user('Turnly Admin', 'admin@turnly.app', 'admin', hash);
        await user('Ayesha Khan', 'patient@turnly.app', 'patient', hash);
        const m1 = await user('Dr. Farhan Ali', 'manager1@turnly.app', 'manager', hash);
        const m2 = await user('Mrs. Nadia Aslam', 'manager2@turnly.app', 'manager', hash);
        const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        await hospital(m1, {
            name: 'City General Hospital', type: 'Private', address: 'Clifton Block 5', city: 'Karachi', phone: '+92 21 3587 0000',
            email: 'manager1@turnly.app', manager: 'Dr. Farhan Ali', lat: 24.8138, lng: 67.0299,
            departments: [
                { name: 'Cardiology', description: 'Heart and blood pressure', limit: 120, icon: 'cardiology', doctors: [
                    { name: 'Dr. Ahmed Raza', spec: 'Cardiologist', qual: 'MBBS, FCPS', years: 12, days: week, from: '10:00', to: '14:00', limit: 40, room: 'Room 4' },
                    { name: 'Dr. Sana Farooq', spec: 'Cardiologist', qual: 'MBBS, MRCP', years: 9, days: ['Mon', 'Wed', 'Fri'], from: '16:00', to: '20:00', limit: 30, room: 'Room 5' }] },
                { name: 'Pediatrics', description: 'Children health', limit: 160, icon: 'pediatrics', doctors: [
                    { name: 'Dr. Hina Qureshi', spec: 'Pediatrician', qual: 'MBBS, DCH', years: 8, days: week, from: '09:00', to: '17:00', limit: 50, room: 'Room 7' }] },
            ],
        });
        await hospital(m2, {
            name: 'Shifa Care Clinic', type: 'Private', address: 'Gulberg III', city: 'Lahore', phone: '+92 42 3577 1111',
            email: 'manager2@turnly.app', manager: 'Mrs. Nadia Aslam', lat: 31.5204, lng: 74.3587,
            departments: [
                { name: 'General Medicine', description: 'General physician', limit: 100, icon: 'general', doctors: [
                    { name: 'Dr. Bilal Shah', spec: 'General Physician', qual: 'MBBS', years: 6, days: week, from: '09:00', to: '18:00', limit: 60, room: 'Room 2' }] },
            ],
        });

        console.log('Demo data ready. Accounts (password "' + PASSWORD + '"):');
        console.log('  admin@turnly.app     (admin)\n  manager1@turnly.app  (manager, City General Hospital)\n  manager2@turnly.app  (manager, Shifa Care Clinic)\n  patient@turnly.app   (patient)');
        process.exit(0);
    } catch (e) {
        console.error('Seed failed:', e.message);
        process.exit(1);
    }
})();
