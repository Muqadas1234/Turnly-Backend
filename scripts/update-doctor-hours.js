// One-time script to seed availability_hours for existing doctors in the database
require('dotenv').config();
const pool = require('../config/db');

async function updateDoctorHours() {
    try {
        // Fetch all doctors that still have the default or null availability_hours
        const result = await pool.query(
            `SELECT id, name FROM doctors ORDER BY id ASC`
        );

        // Sample realistic OPD schedules to assign to existing doctors
        const schedules = [
            'Mon-Sat · 9:00 AM - 1:00 PM',
            'Mon-Fri · 10:00 AM - 2:00 PM',
            'Tue-Sun · 3:00 PM - 7:00 PM',
            'Mon-Sat · 11:00 AM - 3:00 PM',
            'Mon-Wed-Fri · 9:00 AM - 12:00 PM',
            'Mon-Sat · 2:00 PM - 6:00 PM',
        ];

        let updated = 0;
        for (let i = 0; i < result.rows.length; i++) {
            const doctor = result.rows[i];
            const schedule = schedules[i % schedules.length];

            await pool.query(
                `UPDATE doctors SET availability_hours = $1 WHERE id = $2`,
                [schedule, doctor.id]
            );

            console.log(`Updated Dr. ${doctor.name} -> ${schedule}`);
            updated++;
        }

        console.log(`\nDone. Updated ${updated} doctor(s) with availability_hours.`);
        process.exit(0);
    } catch (error) {
        console.error('Error updating doctor hours:', error.message);
        process.exit(1);
    }
}

updateDoctorHours();
