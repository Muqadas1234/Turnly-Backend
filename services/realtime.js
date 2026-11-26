// WebSocket hub for the live queue (replaces Firestore snapshots).
//
//   Connect:  ws://HOST:PORT/ws?token=<JWT from /api/auth/login>
//   Client -> server:  {"type":"subscribe","doctor_id":12,"date":"2026-11-15"}   (also "unsubscribe", "ping")
//   Server -> client:  {"event":"...","data":{...}}
//       ready            { user_id }
//       subscribed       { doctor_id, date }
//       token.updated    { id, status, ahead_count, eta_minutes, ... }   -> the token's owner
//       queue.updated    { doctor_id, date, now_serving, waiting_count } -> everyone watching that queue
//       notification     { id, type, title, body, data, created_at }     -> the user
//       error            { message }
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

let WebSocketServer = null;
try {
    ({ WebSocketServer } = require('ws'));
} catch (_) {
    console.warn('[realtime] "ws" package not installed - run `npm install`. Live updates disabled (REST still works).');
}

const MAX_ROOMS_PER_SOCKET = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const userSockets = new Map(); // userId -> Set<ws>
const rooms = new Map();       // roomKey -> Set<ws>
const roomKey = (doctorId, date) => `queue:${doctorId}:${date}`;

const add = (map, k, ws) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(ws); };
const remove = (map, k, ws) => { const s = map.get(k); if (!s) return; s.delete(ws); if (!s.size) map.delete(k); };
const send = (ws, event, data) => { if (ws.readyState === 1) ws.send(JSON.stringify({ event, data })); };

function emitToUser(userId, event, data) {
    const s = userSockets.get(Number(userId));
    if (s) s.forEach((ws) => send(ws, event, data));
}

function emitToRoom(doctorId, date, event, data) {
    const s = rooms.get(roomKey(doctorId, date));
    if (s) s.forEach((ws) => send(ws, event, data));
}

// A user may watch a queue if admin, manager of that doctor's hospital, or holds a token on that queue
async function canSubscribe(user, doctorId, date) {
    if (user.role === 'admin') return true;
    if (user.role === 'manager') {
        const r = await pool.query('SELECT 1 FROM doctors d JOIN hospitals h ON h.id = d.hospital_id WHERE d.id = $1 AND h.manager_id = $2', [doctorId, user.id]);
        return r.rowCount > 0;
    }
    const r = await pool.query('SELECT 1 FROM tokens WHERE doctor_id = $1 AND booking_date = $2 AND patient_id = $3 LIMIT 1', [doctorId, date, user.id]);
    return r.rowCount > 0;
}

function attach(server) {
    if (!WebSocketServer) return null;
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        // Register these BEFORE any await so nothing is lost while we authenticate:
        //  - 'error' without a listener would crash the process
        //  - messages that arrive during auth are buffered and replayed afterwards
        //  - a close during auth must still clean up
        let user = null;
        let closed = false;
        ws.isAlive = true; // so the heartbeat does not kill a socket that is still authenticating
        const early = [];
        const buffer = (raw) => { if (early.length < 20) early.push(raw); };
        ws.on('error', () => { /* socket errors are followed by 'close' */ });
        ws.on('message', buffer);
        ws.on('close', () => {
            closed = true;
            if (!user) return;
            remove(userSockets, user.id, ws);
            (ws.rooms || []).forEach((k) => remove(rooms, k, ws));
        });

        (async () => {
            try {
                const url = new URL(req.url, 'http://localhost');
                const payload = jwt.verify(url.searchParams.get('token') || '', process.env.JWT_SECRET);
                const r = await pool.query('SELECT id, role FROM users WHERE id = $1', [payload.userId]);
                user = r.rows[0] || null;
            } catch (_) { /* unauthorised */ }
            if (!user) { try { ws.close(4401, 'Unauthorized'); } catch (_) {} return; }
            if (closed) { user = null; return; } // client left while we were checking

            ws.rooms = new Set();
            add(userSockets, user.id, ws);
            ws.on('pong', () => { ws.isAlive = true; });

            const onMessage = async (raw) => {
                let m;
                try { m = JSON.parse(raw.toString()); } catch (_) { return; }
                if (!m || typeof m !== 'object') return;
                if (m.type === 'ping') return send(ws, 'pong', {});
                if (m.type !== 'subscribe' && m.type !== 'unsubscribe') return;

                const doctorId = Number(m.doctor_id);
                if (!Number.isInteger(doctorId) || doctorId <= 0 || typeof m.date !== 'string' || !DATE_RE.test(m.date)) {
                    return send(ws, 'error', { message: 'doctor_id and date (YYYY-MM-DD) are required' });
                }
                const key = roomKey(doctorId, m.date);
                if (m.type === 'unsubscribe') { remove(rooms, key, ws); ws.rooms.delete(key); return; }
                if (!ws.rooms.has(key) && ws.rooms.size >= MAX_ROOMS_PER_SOCKET) {
                    return send(ws, 'error', { message: 'Too many subscriptions' });
                }
                try {
                    if (await canSubscribe(user, doctorId, m.date)) {
                        if (closed) return;
                        add(rooms, key, ws); ws.rooms.add(key);
                        send(ws, 'subscribed', { doctor_id: doctorId, date: m.date });
                    } else send(ws, 'error', { message: 'Not allowed to watch this queue' });
                } catch (_) { send(ws, 'error', { message: 'Subscription failed' }); }
            };

            ws.off('message', buffer);
            ws.on('message', onMessage);
            send(ws, 'ready', { user_id: user.id });
            early.splice(0).forEach(onMessage); // replay anything sent during auth
        })();
    });

    const timer = setInterval(() => {
        wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); });
    }, 30000);
    timer.unref();
    wss.on('close', () => clearInterval(timer));
    return wss;
}

module.exports = { attach, emitToUser, emitToRoom };