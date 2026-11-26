const pool = require('../config/db');

const PLATFORMS = ['android', 'ios', 'web'];

/** Register (or move) a device token to this user. A token belongs to exactly one account. */
async function saveDeviceToken(userId, token, platform) {
    const plat = PLATFORMS.includes(platform) ? platform : null;
    await pool.query(
        `INSERT INTO user_devices (user_id, fcm_token, platform)
         VALUES ($1, $2, $3)
         ON CONFLICT (fcm_token)
         DO UPDATE SET user_id = EXCLUDED.user_id,
                       platform = COALESCE(EXCLUDED.platform, user_devices.platform),
                       last_seen_at = NOW()`,
        [userId, token, plat]
    );
    // legacy single-token column (kept so older clients/reports keep working)
    await pool.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = $1 AND id <> $2', [token, userId]);
    await pool.query('UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2', [token, userId]);
}

/** Logout on one device: stop pushes to that token only. */
async function removeDeviceToken(userId, token) {
    await pool.query('DELETE FROM user_devices WHERE user_id = $1 AND fcm_token = $2', [userId, token]);
    await pool.query('UPDATE users SET fcm_token = NULL WHERE id = $1 AND fcm_token = $2', [userId, token]);
}

/** Remove tokens FCM reported as dead (everywhere they appear). */
async function purgeTokens(tokens) {
    if (!tokens.length) return;
    await pool.query('DELETE FROM user_devices WHERE fcm_token = ANY($1::text[])', [tokens]);
    await pool.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = ANY($1::text[])', [tokens]);
}

/** All tokens for a user (user_devices + legacy column), de-duplicated. */
async function tokensForUser(userId) {
    const { rows } = await pool.query(
        `SELECT fcm_token FROM user_devices WHERE user_id = $1
         UNION
         SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL`,
        [userId]
    );
    return rows.map((r) => r.fcm_token);
}

module.exports = { saveDeviceToken, removeDeviceToken, purgeTokens, tokensForUser };