const pool = require('../config/db');

async function migrateHospitals() {
  try {
    await pool.query(`
      ALTER TABLE hospitals 
      ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'Private hospital',
      ADD COLUMN IF NOT EXISTS opd_timings VARCHAR(100) DEFAULT '9:00 AM - 8:00 PM',
      ADD COLUMN IF NOT EXISTS rejection_note TEXT;
    `);
    console.log('Hospitals table columns verified and updated successfully.');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

migrateHospitals();
