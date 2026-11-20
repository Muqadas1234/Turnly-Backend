const { Pool, types } = require('pg');
require('dotenv').config();

// DATE -> 'YYYY-MM-DD' string (not a JS Date), NUMERIC/DECIMAL -> number, COUNT (bigint) -> number
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Cloud databases (Neon, Supabase...) need SSL. For a local PostgreSQL set DB_SSL=false in .env
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => console.error('PostgreSQL idle client error:', err.message));

pool.query('SELECT NOW()')
    .then(() => console.log('PostgreSQL connected'))
    .catch((err) => console.error('DB error:', err.message));

module.exports = pool;
