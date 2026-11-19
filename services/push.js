// OPTIONAL FCM push. Uses firebase-admin (already in package.json) and users.fcm_token.
// Enabled automatically when credentials are provided:
//   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json   (or)   FIREBASE_SERVICE_ACCOUNT_JSON='{...}'
// Without credentials push is skipped; in-app notifications + WebSocket still work.
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

let messaging = null;
let tried = false;

function getMessaging() {
    if (tried) return messaging;
    tried = true;
    try {
        let cred = null;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH))) {
            cred = JSON.parse(fs.readFileSync(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH), 'utf8'));
        }
        if (!cred) {
            console.log('[push] No Firebase credentials found - push notifications disabled');
            return null;
        }
        const admin = require('firebase-admin');
        if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cred) });
        messaging = admin.messaging();
        console.log('[push] FCM enabled');
    } catch (err) {
        console.warn('[push] FCM disabled:', err.message);
    }
    return messaging;
}

const STALE = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

async function sendPush(userId, { title, body, data = {} }) {
    const m = getMessaging();
    if (!m) return;
    const { rows } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [userId]);
    const token = rows[0] && rows[0].fcm_token;
    if (!token) return;
    try {
        await m.send({
            token,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
            android: { priority: 'high', notification: { channelId: 'turnly_queue' } },
            apns: { payload: { aps: { sound: 'default' } } },
        });
    } catch (err) {
        if (STALE.includes(err.code)) await pool.query('UPDATE users SET fcm_token = NULL WHERE id = $1', [userId]);
        else console.error('[push] send failed:', err.message);
    }
}

module.exports = { sendPush };
