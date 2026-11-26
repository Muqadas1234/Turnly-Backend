// Usage: node scripts/test-notify.js <userId> [type]
// Sends a FULL notification the same way the app does: saves it (so it shows in the
// Notification Center screen), pushes it over WebSocket, and sends the phone push.
// Types: token_booked | turn_near | token_called | token_cancelled | token_skipped | priority_approved
require('dotenv').config();
const pool = require('../config/db');
const { notifyUser } = require('../services/notify');

const userId = parseInt(process.argv[2], 10);
const type = process.argv[3] || 'token_called';
if (!userId) {
    console.error('Usage: node scripts/test-notify.js <userId> [type]');
    process.exit(1);
}

const samples = {
    token_booked: { title: 'Token booked', body: 'Token #12 booked for Dr. Ahmed at City General.' },
    turn_near: { title: 'Your turn is coming!', body: 'Only 2 patients ahead of token #12. Head to the hospital.' },
    token_called: { title: "You're being called", body: 'Token #12 - please go to Room 4 now.' },
    token_cancelled: { title: 'Token cancelled', body: 'Token #14 for Dr. Sana Farooq was cancelled.' },
    token_skipped: { title: 'Token skipped', body: 'Token #12 was marked as a no-show. Please contact reception to rejoin.' },
    priority_approved: { title: 'Priority approved', body: 'Token #12 has been moved up the queue.' },
};

(async () => {
    const s = samples[type];
    if (!s) {
        console.error(`Unknown type "${type}". Use one of: ${Object.keys(samples).join(', ')}`);
        process.exit(1);
    }
    const u = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (!u.rows.length) {
        console.error(`No user with id ${userId} in this database. Run: node scripts/list-users.js`);
        process.exit(1);
    }
    const dev = await pool.query('SELECT COUNT(*)::int AS n FROM user_devices WHERE user_id = $1', [userId]);
    console.log(`User ${userId} (${u.rows[0].email}) has ${dev.rows[0].n} registered device(s).`);
    if (!dev.rows[0].n) console.log('-> No devices: log in on the phone first, or no phone push will arrive.');

    await notifyUser(userId, { type, ...s, data: { token_id: 0 } });

    const saved = await pool.query(
        'SELECT id FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [userId]);
    console.log(`Done. Latest saved notification id: ${saved.rows[0] ? saved.rows[0].id : 'none (insert failed - see [notify] error above)'}`);
    await pool.end();
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });