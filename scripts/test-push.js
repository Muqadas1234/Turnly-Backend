// Usage: node scripts/test-push.js <userId> [type]
// Sends a test push to every registered device of a user, using the same code path as real notifications.
require('dotenv').config();
const pool = require('../config/db');
const { sendPush } = require('../services/push');
const { tokensForUser } = require('../services/devices');

const userId = parseInt(process.argv[2], 10);
const type = process.argv[3] || 'token_called';
if (!userId) {
    console.error('Usage: node scripts/test-push.js <userId> [type]');
    process.exit(1);
}

(async () => {
    const tokens = await tokensForUser(userId);
    console.log(`User ${userId} has ${tokens.length} registered device token(s).`);
    if (!tokens.length) console.log('-> No tokens: the app has not registered with the backend yet.');
    await sendPush(userId, {
        title: 'Turnly test',
        body: `Test notification (${type})`,
        data: { type, token_id: 0 },
    });
    const after = await tokensForUser(userId);
    console.log(`Done. ${after.length} token(s) remain (${tokens.length - after.length} removed as invalid).`);
    await pool.end();
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });