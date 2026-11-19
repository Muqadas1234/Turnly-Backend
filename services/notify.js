const pool = require('../config/db');
const { emitToUser } = require('./realtime');
const { sendPush } = require('./push');

/**
 * Save an in-app notification, push it live over WebSocket and (if FCM is configured) as a phone push.
 * Never throws - a failed notification must not break booking or queue actions.
 */
async function notifyUser(userId, { type, title, body, data = {} }) {
    try {
        const { rows } = await pool.query(
            `INSERT INTO notifications (user_id, type, title, body, data)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, type, title, body, data, is_read, created_at`,
            [userId, type, title, body, JSON.stringify(data)]
        );
        emitToUser(userId, 'notification', rows[0]);
        await sendPush(userId, { title, body, data: { type, ...data } });
    } catch (err) {
        console.error('[notify] failed:', err.message);
    }
}

// t = token row joined with doctor_name / room / hospital_name
const templates = {
    booked: (t) => ({ type: 'token_booked', title: 'Token booked', body: `Token #${t.token_number} booked for ${t.doctor_name} at ${t.hospital_name}`, data: { token_id: t.id } }),
    near: (t, ahead) => ({ type: 'turn_near', title: 'Your turn is coming!', body: `Only ${ahead} patient${ahead === 1 ? '' : 's'} ahead of token #${t.token_number}. Head to the hospital.`, data: { token_id: t.id } }),
    called: (t) => ({ type: 'token_called', title: "You're being called", body: `Token #${t.token_number} - please go to ${t.room || "the doctor's room"} now.`, data: { token_id: t.id } }),
    cancelled: (t) => ({ type: 'token_cancelled', title: 'Token cancelled', body: `Token #${t.token_number} for ${t.doctor_name} was cancelled.`, data: { token_id: t.id } }),
    skipped: (t) => ({ type: 'token_skipped', title: 'Token skipped', body: `Token #${t.token_number} was marked as a no-show. Please contact reception to rejoin.`, data: { token_id: t.id } }),
    priority: (t, ok) => ({ type: ok ? 'priority_approved' : 'priority_rejected', title: ok ? 'Priority approved' : 'Priority not approved', body: ok ? `Token #${t.token_number} has been moved up the queue.` : `Priority was not approved for token #${t.token_number}.`, data: { token_id: t.id } }),
};

module.exports = { notifyUser, templates };
