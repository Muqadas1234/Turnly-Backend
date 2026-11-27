// Run once to setup database tables
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },});

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
                id                      SERIAL PRIMARY KEY,
                name                    VARCHAR(200) NOT NULL,
                hospital_type           VARCHAR(50) DEFAULT 'Private',
                address                 TEXT,
                city                    VARCHAR(100),
                phone                   VARCHAR(20),
                email                   VARCHAR(150),
                opd_timings             VARCHAR(100),
                logo_url                TEXT,
                status                  VARCHAR(20) DEFAULT 'pending',
                manager_id              INTEGER REFERENCES users(id),
                manager_name            VARCHAR(100),
                manager_email           VARCHAR(150),
                manager_phone           VARCHAR(30),
                manager_designation     VARCHAR(100),
                license_doc_name        VARCHAR(255),
                license_doc_size        VARCHAR(50),
                license_doc_url         TEXT,
                certificate_doc_name    VARCHAR(255),
                certificate_doc_size    VARCHAR(50),
                certificate_doc_url     TEXT,
                rejection_reason        TEXT,
                suspension_reason       TEXT,
                latitude                DECIMAL(10, 8),
                longitude               DECIMAL(11, 8),
                created_at              TIMESTAMP DEFAULT NOW(),
                updated_at              TIMESTAMP DEFAULT NOW()
            );
        `);

        // Safe column additions for existing databases
        await pool.query(`
            ALTER TABLE hospitals
                ADD COLUMN IF NOT EXISTS hospital_type VARCHAR(50) DEFAULT 'Private',
                ADD COLUMN IF NOT EXISTS opd_timings VARCHAR(100),
                ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100),
                ADD COLUMN IF NOT EXISTS manager_email VARCHAR(150),
                ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(30),
                ADD COLUMN IF NOT EXISTS manager_designation VARCHAR(100),
                ADD COLUMN IF NOT EXISTS license_doc_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS license_doc_size VARCHAR(50),
                ADD COLUMN IF NOT EXISTS license_doc_url TEXT,
                ADD COLUMN IF NOT EXISTS certificate_doc_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS certificate_doc_size VARCHAR(50),
                ADD COLUMN IF NOT EXISTS certificate_doc_url TEXT,
                ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
                ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
        `);
            await pool.query(`
    ALTER TABLE hospitals
    ALTER COLUMN manager_id DROP NOT NULL;
`);
        // Migrate legacy friend-backend column names into the canonical schema.
        // Dynamic SQL is used so this also runs when the legacy columns do not exist.
        await pool.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema() AND table_name = 'hospitals' AND column_name = 'type'
                ) THEN
                    EXECUTE 'UPDATE hospitals SET hospital_type = type WHERE type IS NOT NULL AND (hospital_type IS NULL OR hospital_type = ''Private'')';
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema() AND table_name = 'hospitals' AND column_name = 'rejection_note'
                ) THEN
                    EXECUTE 'UPDATE hospitals SET rejection_reason = rejection_note WHERE rejection_reason IS NULL AND rejection_note IS NOT NULL';
                END IF;
            END $$;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id                  SERIAL PRIMARY KEY,
                hospital_id         INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
                name                VARCHAR(100) NOT NULL,
                description         TEXT,
                daily_token_limit   INTEGER DEFAULT 50,
                is_active           BOOLEAN DEFAULT true,
                icon_key            VARCHAR(50) DEFAULT 'general',
                created_at          TIMESTAMP DEFAULT NOW(),
                updated_at          TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            ALTER TABLE departments
                ADD COLUMN IF NOT EXISTS daily_token_limit INTEGER DEFAULT 50,
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
                ADD COLUMN IF NOT EXISTS icon_key VARCHAR(50) DEFAULT 'general',
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
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
                patient_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
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

        // ------------------------------------------------------------------
        // v2 additions: doctors schedule, token queue fields, counters, notifications
        // (all statements are idempotent - safe to run on an existing database)
        // ------------------------------------------------------------------
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
            ALTER TABLE email_otps ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) DEFAULT 'verify';
        `);

        await pool.query(`
            ALTER TABLE doctors
                ADD COLUMN IF NOT EXISTS schedule_days TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri','Sat'],
                ADD COLUMN IF NOT EXISTS schedule_from VARCHAR(5) DEFAULT '09:00',
                ADD COLUMN IF NOT EXISTS schedule_to VARCHAR(5) DEFAULT '17:00',
                ADD COLUMN IF NOT EXISTS daily_token_limit INTEGER DEFAULT 40,
                ADD COLUMN IF NOT EXISTS room VARCHAR(40),
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
        `);

        // running average of consultation time needs decimals
        await pool.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name = 'doctors' AND column_name = 'avg_consult_minutes' AND data_type = 'integer') THEN
                    ALTER TABLE doctors ALTER COLUMN avg_consult_minutes TYPE NUMERIC(5,1);
                END IF;
            END $$;
        `);

        await pool.query(`
            ALTER TABLE tokens
                ADD COLUMN IF NOT EXISTS family_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS patient_age INTEGER,
                ADD COLUMN IF NOT EXISTS relation VARCHAR(50) DEFAULT 'self',
                ADD COLUMN IF NOT EXISTS priority SMALLINT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS priority_category VARCHAR(20),
                ADD COLUMN IF NOT EXISTS priority_status VARCHAR(20) DEFAULT 'none',
                ADD COLUMN IF NOT EXISTS ahead_count INTEGER,
                ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
                ADD COLUMN IF NOT EXISTS near_notified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS notes TEXT,
                ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
        `);

        // Convert the legacy active-token state used by the original patient module.
        await pool.query(`UPDATE tokens SET status = 'serving' WHERE status = 'in_progress'`);

        // one row per doctor per day: the atomic upsert on this row hands out token numbers safely
        await pool.query(`
            CREATE TABLE IF NOT EXISTS token_counters (
                doctor_id       INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
                counter_date    DATE NOT NULL,
                last_number     INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (doctor_id, counter_date)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type        VARCHAR(40) NOT NULL,
                title       VARCHAR(150) NOT NULL,
                body        TEXT NOT NULL,
                data        JSONB NOT NULL DEFAULT '{}',
                is_read     BOOLEAN NOT NULL DEFAULT false,
                created_at  TIMESTAMP DEFAULT NOW()
            );
        `);
                  // One row per device so a user can be signed in on phone + web + tablet.
        // users.fcm_token stays for backward compatibility (legacy single-token clients).
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_devices (
                id            SERIAL PRIMARY KEY,
                user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                fcm_token     TEXT NOT NULL UNIQUE,
                platform      VARCHAR(10),
                created_at    TIMESTAMP DEFAULT NOW(),
                last_seen_at  TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            INSERT INTO user_devices (user_id, fcm_token, platform)
            SELECT id, fcm_token, 'unknown' FROM users WHERE fcm_token IS NOT NULL
            ON CONFLICT (fcm_token) DO NOTHING;
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS user_devices_user_idx ON user_devices (user_id)`);

        // Ensure tokens.patient_id cascades on user deletion
        await pool.query(`
            DO $$
            BEGIN
                ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_patient_id_fkey;
                ALTER TABLE tokens ADD CONSTRAINT tokens_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE;
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;
        `);
        const indexes = [
            
            // a token number is unique per doctor per day
            `CREATE UNIQUE INDEX IF NOT EXISTS tokens_number_uq ON tokens (doctor_id, booking_date, token_number)`,
            // the same person cannot hold two live tokens with one doctor on one day
            `CREATE UNIQUE INDEX IF NOT EXISTS tokens_one_active_uq ON tokens (doctor_id, booking_date, patient_id, COALESCE(family_member_id, 0)) WHERE status IN ('waiting','serving')`,
            `CREATE INDEX IF NOT EXISTS tokens_queue_idx ON tokens (doctor_id, booking_date, status)`,
            `CREATE INDEX IF NOT EXISTS tokens_patient_idx ON tokens (patient_id, booking_date)`,
            `CREATE INDEX IF NOT EXISTS tokens_hospital_idx ON tokens (hospital_id, booking_date)`,
            `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS hospitals_status_idx ON hospitals (status)`,
            `CREATE INDEX IF NOT EXISTS doctors_hospital_idx ON doctors (hospital_id)`,
        ];
        for (const sql of indexes) {
            try {
                await pool.query(sql);
            } catch (e) {
                console.warn('Index skipped (existing data conflicts?):', e.message);
            }
        }

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
