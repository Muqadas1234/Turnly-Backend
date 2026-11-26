// Usage: node scripts/token-owners.js
// Shows ONLY the accounts that have a phone push token (new table or old column).
require('dotenv').config();
const pool = require('../config/db');

(async () => {
    const { rows } = await pool.query(`
        SELECT u.id, u.email, u.role,
               (SELECT COUNT(*)::int FROM user_devices d WHERE d.user_id = u.id) AS devices,
               (u.fcm_token IS NOT NULL) AS legacy_token
        FROM users u
        WHERE u.fcm_token IS NOT NULL
           OR EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id = u.id)
        ORDER BY u.id`);
    if (!rows.length) console.log('No account has a phone token yet. The phone has not registered with THIS database.');
    else console.table(rows);
    await pool.end();
    process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });