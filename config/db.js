const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

pool.query('SELECT NOW()')
    .then(() => console.log('PostgreSQL connected'))
    .catch((err) => console.error('DB error:', err.message));

module.exports = pool;
