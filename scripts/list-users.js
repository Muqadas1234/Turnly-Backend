// Usage: node scripts/list-users.js
// Lists users and how many push devices each has registered (replaces psql).
require('dotenv').config();
const pool = require('../config/db');

(async () => {
    const { rows } = await pool.query(`
        SELECT u.id, u.name, u.email, u.role,
               (SELECT COUNT(*)::int FROM user_devices d WHERE d.user_id = u.id) AS devices
        FROM users u ORDER BY u.id`);
    if (!rows.length) console.log('No users found in this database.');
    console.table(rows);
    await pool.end();
    process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });