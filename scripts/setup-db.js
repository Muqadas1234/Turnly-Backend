// Run once to setup database tables
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const setupDatabase = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id              SERIAL PRIMARY KEY,
                name            VARCHAR(100) NOT NULL,
                email           VARCHAR(150) UNIQUE NOT NULL,
                password_hash   TEXT NOT NULL,
                role            VARCHAR(20) NOT NULL DEFAULT 'patient',
                hospital_id     INTEGER,
                fcm_token       TEXT,
                is_verified     BOOLEAN DEFAULT false,
                created_at      TIMESTAMP DEFAULT NOW(),
                updated_at      TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_otps (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                otp_code    VARCHAR(6) NOT NULL,
                is_used     BOOLEAN DEFAULT false,
                expires_at  TIMESTAMP NOT NULL,
                created_at  TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS hospitals (
                id          SERIAL PRIMARY KEY,
                name        VARCHAR(200) NOT NULL,
                address     TEXT,
                city        VARCHAR(100),
                phone       VARCHAR(20),
                email       VARCHAR(150),
                logo_url    TEXT,
                status      VARCHAR(20) DEFAULT 'pending',
                manager_id  INTEGER REFERENCES users(id),
                latitude    DECIMAL(10, 8),
                longitude   DECIMAL(11, 8),
                created_at  TIMESTAMP DEFAULT NOW(),
                updated_at  TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id          SERIAL PRIMARY KEY,
                hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
                name        VARCHAR(100) NOT NULL,
                description TEXT,
                created_at  TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS doctors (
                id                  SERIAL PRIMARY KEY,
                hospital_id         INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
                department_id       INTEGER REFERENCES departments(id) ON DELETE SET NULL,
                name                VARCHAR(100) NOT NULL,
                specialization      VARCHAR(100),
                qualification       VARCHAR(200),
                experience_years    INTEGER,
                photo_url           TEXT,
                avg_consult_minutes INTEGER DEFAULT 10,
                is_available        BOOLEAN DEFAULT true,
                created_at          TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS tokens (
                id              SERIAL PRIMARY KEY,
                token_number    INTEGER NOT NULL,
                patient_id      INTEGER REFERENCES users(id),
                doctor_id       INTEGER REFERENCES doctors(id),
                hospital_id     INTEGER REFERENCES hospitals(id),
                department_id   INTEGER REFERENCES departments(id),
                patient_name    VARCHAR(100),
                status          VARCHAR(20) DEFAULT 'waiting',
                booking_date    DATE NOT NULL DEFAULT CURRENT_DATE,
                estimated_time  TIME,
                called_at       TIMESTAMP,
                completed_at    TIMESTAMP,
                created_at      TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS family_members (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name        VARCHAR(100) NOT NULL,
                relation    VARCHAR(50),
                age         INTEGER,
                created_at  TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'fk_user_hospital'
                ) THEN
                    ALTER TABLE users ADD CONSTRAINT fk_user_hospital
                        FOREIGN KEY (hospital_id) REFERENCES hospitals(id);
                END IF;
            END $$;
        `);

        console.log('Database tables ready');
        process.exit(0);
    } catch (error) {
        console.error('Setup error:', error.message);
        process.exit(1);
    }
};

setupDatabase();
