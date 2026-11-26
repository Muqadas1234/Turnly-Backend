// OPTIONAL FCM push. Uses firebase-admin (already in package.json).
// Enabled automatically when credentials are provided:
//   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json   (or)   FIREBASE_SERVICE_ACCOUNT_JSON='{...}'
// Without credentials push is skipped; in-app notifications + WebSocket still work.
const fs = require('fs');
const path = require('path');
const { tokensForUser, purgeTokens } = require('./devices');

let messaging = null;
let tried = false;

function getMessaging() {
    if (tried) return messaging;
    tried = true;
    try {
        let cred = null;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            // hosting dashboards often store the key with literal \n sequences
            if (cred.private_key) cred.private_key = cred.private_key.replace(/\\n/g, '\n');
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH))) {
            cred = JSON.parse(fs.readFileSync(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH), 'utf8'));
        }
        if (!cred) {
            console.log('[push] No Firebase credentials found - push notifications disabled');
            return null;
        }
               // firebase-admin v12+ uses modular imports (the old admin.apps / admin.credential API is gone in v14)
        const { initializeApp, getApps, cert } = require('firebase-admin/app');
        const { getMessaging: getFcm } = require('firebase-admin/messaging');
        if (!getApps().length) initializeApp({ credential: cert(cred) });
        messaging = getFcm();
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
    const tokens = await tokensForUser(userId);
    if (!tokens.length) return;
    try {
        const res = await m.sendEachForMulticast({
            tokens,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
            android: { priority: 'high', notification: { channelId: 'turnly_queue' } },
            apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } },
            webpush: { headers: { Urgency: 'high' }, notification: { icon: '/icons/Icon-192.png' } },
        });
        const dead = [];
        res.responses.forEach((r, i) => {
            if (r.success) return;
            const code = r.error && r.error.code;
            if (STALE.includes(code)) dead.push(tokens[i]);
            else console.error('[push] send failed:', code, r.error && r.error.message);
        });
        await purgeTokens(dead);
        if (dead.length) console.log(`[push] removed ${dead.length} invalid token(s) for user ${userId}`);
    } catch (err) {
        console.error('[push] send failed:', err.message);
    }
}

module.exports = { sendPush };