// Create (or promote) a platform admin account.
//   node scripts/create-admin.js admin@turnly.app "StrongPassword1" "Turnly Admin"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

(async () => {
    const [email, password, name = 'Turnly Admin'] = process.argv.slice(2);
    if (!email || !password) {
        console.log('Usage: node scripts/create-admin.js <email> <password> [name]');
        process.exit(1);
    }
    try {
        const hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
        const r = await pool.query(
            `INSERT INTO users (name, email, password_hash, role, is_verified)
             VALUES ($1, $2, $3, 'admin', true)
             ON CONFLICT (email) DO UPDATE SET role = 'admin', is_verified = true, password_hash = EXCLUDED.password_hash, updated_at = NOW()
             RETURNING id, email, role`,
            [name, email, hash]
        );
        console.log('Admin ready:', r.rows[0]);
        process.exit(0);
    } catch (e) {
        console.error('Failed:', e.message);
        process.exit(1);
    }
})();
