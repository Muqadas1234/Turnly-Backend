require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedHospitals() {
  try {
    // 1. Create dummy managers first
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('Manager123', salt);

    const managers = [
      { name: 'Dr. Farhan Ali', email: 'farhan@cgh.pk' },
      { name: 'Mrs. Nadia Aslam', email: 'nadia@shifa.pk' },
      { name: 'Mr. Usman Tariq', email: 'usman@noor.pk' },
      { name: 'Dr. Ayesha Khan', email: 'ayesha@aku.edu' }
    ];

    const managerIds = {};
    for (const m of managers) {
      let res = await pool.query('SELECT id FROM users WHERE email = $1', [m.email]);
      if (res.rows.length === 0) {
        res = await pool.query(
          `INSERT INTO users (name, email, password_hash, role, is_verified)
           VALUES ($1, $2, $3, 'hospital_manager', true)
           RETURNING id`,
          [m.name, m.email, defaultPassword]
        );
      }
      managerIds[m.email] = res.rows[0].id;
    }

    // 2. Sample hospitals
    const hospitals = [
      {
        name: 'City General Hospital',
        city: 'Karachi',
        address: 'Clifton Block 5, Karachi',
        phone: '+92 21 3587 0000',
        email: 'info@cgh.pk',
        type: 'Private hospital',
        opd_timings: '9:00 AM - 8:00 PM',
        status: 'pending',
        manager_id: managerIds['farhan@cgh.pk']
      },
      {
        name: 'Shifa Care Clinic',
        city: 'Lahore',
        address: 'Gulberg III, Lahore',
        phone: '+92 42 3575 1111',
        email: 'contact@shifa.pk',
        type: 'Clinic / Outpatient',
        opd_timings: '10:00 AM - 9:00 PM',
        status: 'pending',
        manager_id: managerIds['nadia@shifa.pk']
      },
      {
        name: 'Noor Medical Center',
        city: 'Islamabad',
        address: 'Sector F-8, Islamabad',
        phone: '+92 51 2850 2222',
        email: 'care@noor.pk',
        type: 'Private hospital',
        opd_timings: '8:00 AM - 6:00 PM',
        status: 'pending',
        manager_id: managerIds['usman@noor.pk']
      },
      {
        name: 'Aga Khan University Hospital',
        city: 'Karachi',
        address: 'Stadium Road, Karachi',
        phone: '+92 21 3493 0051',
        email: 'info@aku.edu',
        type: 'Teaching hospital',
        opd_timings: '24/7 Emergency & OPD',
        status: 'approved',
        manager_id: managerIds['ayesha@aku.edu']
      }
    ];

    for (const h of hospitals) {
      const check = await pool.query('SELECT id FROM hospitals WHERE name = $1', [h.name]);
      if (check.rows.length === 0) {
        await pool.query(
          `INSERT INTO hospitals (name, city, address, phone, email, type, opd_timings, status, manager_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [h.name, h.city, h.address, h.phone, h.email, h.type, h.opd_timings, h.status, h.manager_id]
        );
        console.log('Seeded hospital:', h.name, '(' + h.status + ')');
      }
    }

    console.log('Sample hospitals seeded successfully.');
  } catch (error) {
    console.error('Error seeding hospitals:', error);
  } finally {
    await pool.end();
  }
}

seedHospitals();
