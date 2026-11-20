const pool = require('../config/db');

// Validate canonical YYYY-MM-DD date and verify real calendar existence (handling leap years and impossible dates)
function isValidCalendarDate(dateStr) {
    if (typeof dateStr !== 'string') return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

// Fetch all approved hospitals for patients (with search and city filter)
exports.getApprovedHospitals = async (req, res) => {
    try {
        const { city, search } = req.query;

        let query = `
            SELECT 
                h.id,
                h.name,
                h.address,
                h.city,
                h.phone,
                h.email,
                h.type,
                h.opd_timings,
                h.status,
                COUNT(DISTINCT d.id) AS doctors_count
            FROM hospitals h
            LEFT JOIN doctors d ON h.id = d.hospital_id AND d.is_available = true
            WHERE h.status = 'approved'
        `;

        const params = [];

        if (city && city.toLowerCase() !== 'all') {
            params.push(city.toLowerCase());
            query += ` AND LOWER(h.city) = $${params.length}`;
        }

        if (search && search.trim().length > 0) {
            params.push(`%${search.trim().toLowerCase()}%`);
            query += ` AND (
                LOWER(h.name) LIKE $${params.length} 
                OR LOWER(h.city) LIKE $${params.length} 
                OR LOWER(h.address) LIKE $${params.length}
                OR LOWER(COALESCE(h.type, '')) LIKE $${params.length}
                OR LOWER(COALESCE(d.name, '')) LIKE $${params.length}
                OR LOWER(COALESCE(d.specialization, '')) LIKE $${params.length}
            )`;
        }

        query += ` GROUP BY h.id ORDER BY h.name ASC`;

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching approved hospitals:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching hospitals'
        });
    }
};

// Fetch single hospital details (with departments and doctors)
exports.getHospitalDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const hospitalResult = await pool.query(
            `SELECT * FROM hospitals WHERE id = $1 AND status = 'approved'`,
            [id]
        );

        if (hospitalResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hospital not found or not approved'
            });
        }

        const departmentsResult = await pool.query(
            `SELECT * FROM departments WHERE hospital_id = $1 ORDER BY name ASC`,
            [id]
        );

        const doctorsResult = await pool.query(
            `SELECT * FROM doctors WHERE hospital_id = $1 AND is_available = true ORDER BY name ASC`,
            [id]
        );

        // Remove internal admin review note from public response
        const { rejection_note: _rejectionNote, ...hospital } = hospitalResult.rows[0];

        return res.status(200).json({
            success: true,
            data: {
                hospital,
                departments: departmentsResult.rows,
                doctors: doctorsResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching hospital details:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Fetch current active token for logged in patient
exports.getActiveToken = async (req, res) => {
    try {
        const patientId = req.userId;

        const query = `
            SELECT 
                t.id,
                t.token_number,
                t.status,
                t.booking_date,
                t.estimated_time,
                d.name AS doctor_name,
                d.specialization AS doctor_specialization,
                h.name AS hospital_name,
                h.address AS hospital_address,
                (
                    SELECT COUNT(*) 
                    FROM tokens t2 
                    WHERE t2.doctor_id = t.doctor_id 
                      AND t2.booking_date = CURRENT_DATE 
                      AND t2.status = 'waiting' 
                      AND t2.token_number < t.token_number
                ) AS patients_ahead
            FROM tokens t
            JOIN doctors d ON t.doctor_id = d.id
            JOIN hospitals h ON t.hospital_id = h.id
            WHERE t.patient_id = $1 
              AND t.booking_date = CURRENT_DATE 
              AND t.status IN ('waiting', 'in_progress')
            ORDER BY t.created_at DESC
            LIMIT 1
        `;

        const result = await pool.query(query, [patientId]);

        return res.status(200).json({
            success: true,
            hasActiveToken: result.rows.length > 0,
            data: result.rows.length > 0 ? result.rows[0] : null
        });
    } catch (error) {
        console.error('Error fetching active token:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
// Book a new token for a doctor
exports.bookToken = async (req, res) => {
    try {
        const patientId = req.userId;
        const { doctorId, hospitalId, departmentId, patientName, bookingDate } = req.body;

        if (!doctorId || !hospitalId) {
            return res.status(400).json({
                success: false,
                message: 'Doctor ID and Hospital ID are required'
            });
        }

        // 1. Verify doctor exists and availability managed by hospital
        const doctorResult = await pool.query(
            `SELECT id, hospital_id, department_id, name, specialization, is_available, availability_hours 
             FROM doctors 
             WHERE id = $1`,
            [doctorId]
        );

        if (doctorResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const doctor = doctorResult.rows[0];

        // Block booking if doctor is marked unavailable by manager
        if (!doctor.is_available) {
            return res.status(400).json({
                success: false,
                message: 'This doctor is currently marked as unavailable by the hospital'
            });
        }

        // 2. Validate requested hospital ID matches doctor's hospital
        const parsedHospitalId = parseInt(hospitalId, 10);
        if (doctor.hospital_id !== parsedHospitalId) {
            return res.status(400).json({
                success: false,
                message: 'Selected doctor does not belong to the specified hospital'
            });
        }

        // Verify doctor's hospital exists and is approved
        const hospitalResult = await pool.query(
            `SELECT id, name, status FROM hospitals WHERE id = $1`,
            [doctor.hospital_id]
        );

        if (hospitalResult.rows.length === 0 || hospitalResult.rows[0].status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Hospital is not approved or not found'
            });
        }

        const hospital = hospitalResult.rows[0];

        // 3. Validate canonical YYYY-MM-DD booking date or default to database CURRENT_DATE
        let targetDate;
        if (bookingDate !== undefined && bookingDate !== null) {
            if (typeof bookingDate !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid booking date format. Expected a string in YYYY-MM-DD format'
                });
            }
            const trimmedDate = bookingDate.trim();
            if (trimmedDate.length > 0) {
                if (!isValidCalendarDate(trimmedDate)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid booking date format or impossible calendar date. Expected YYYY-MM-DD (e.g. 2026-11-18)'
                    });
                }
                targetDate = trimmedDate;
            }
        }

        if (!targetDate) {
            const todayResult = await pool.query('SELECT CURRENT_DATE::TEXT AS today');
            targetDate = todayResult.rows[0].today;
        }

        // 4. Resolve patient display name fallback
        let resolvedPatientName = patientName ? patientName.trim() : '';
        if (!resolvedPatientName) {
            const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [patientId]);
            resolvedPatientName = userResult.rows.length > 0 ? userResult.rows[0].name : 'Patient';
        }

        const resolvedDeptId = departmentId || doctor.department_id || null;

        // 5. Atomic transaction with advisory lock to prevent race conditions during token allocation
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Serialize token allocation per doctor and canonical date using transaction advisory lock
            const lockKey = 'booking_' + doctor.id + '_' + targetDate;
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

            // Prevent duplicate waiting tokens for the same patient and doctor on the selected date
            const existingToken = await client.query(
                `SELECT id, token_number FROM tokens 
                 WHERE patient_id = $1 AND doctor_id = $2 AND booking_date = $3 AND status = 'waiting'`,
                [patientId, doctorId, targetDate]
            );

            if (existingToken.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `You already have an active waiting token (#${existingToken.rows[0].token_number}) for this doctor on ${targetDate}`
                });
            }

            // Generate next sequential token number (#1, #2, #3...) atomically
            const nextTokenResult = await client.query(
                `SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token 
                 FROM tokens 
                 WHERE doctor_id = $1 AND booking_date = $2`,
                [doctorId, targetDate]
            );
            const nextTokenNumber = parseInt(nextTokenResult.rows[0].next_token, 10);

            // Insert token into database
            const insertResult = await client.query(
                `INSERT INTO tokens (
                    token_number, 
                    patient_id, 
                    doctor_id, 
                    hospital_id, 
                    department_id, 
                    patient_name, 
                    status, 
                    booking_date
                ) VALUES ($1, $2, $3, $4, $5, $6, 'waiting', $7)
                RETURNING id, token_number, patient_name, status, booking_date, created_at`,
                [
                    nextTokenNumber,
                    patientId,
                    doctorId,
                    doctor.hospital_id,
                    resolvedDeptId,
                    resolvedPatientName,
                    targetDate
                ]
            );

            const newRecord = insertResult.rows[0];

            // Count patients ahead in queue
            const aheadResult = await client.query(
                `SELECT COUNT(*) AS ahead_count 
                 FROM tokens 
                 WHERE doctor_id = $1 AND booking_date = $2 AND status = 'waiting' AND token_number < $3`,
                [doctorId, targetDate, nextTokenNumber]
            );
            const patientsAhead = parseInt(aheadResult.rows[0].ahead_count, 10);

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Token booked successfully',
                data: {
                    ...newRecord,
                    doctor_name: doctor.name,
                    doctor_specialization: doctor.specialization,
                    hospital_name: hospital.name,
                    patients_ahead: patientsAhead
                }
            });
        } catch (txnError) {
            await client.query('ROLLBACK');
            // Handle unique index violations gracefully
            if (txnError.code === '23505') {
                return res.status(400).json({
                    success: false,
                    message: `You already have an active waiting token for this doctor on ${targetDate}`
                });
            }
            throw txnError;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error booking token:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while booking token'
        });
    }
};

// Fetch doctor queue status for booking preview
exports.getDoctorQueueStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { date } = req.query;

        let targetDate;
        if (date !== undefined && date !== null) {
            if (typeof date !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Expected a string in YYYY-MM-DD format'
                });
            }
            const trimmedDate = date.trim();
            if (trimmedDate.length > 0) {
                if (!isValidCalendarDate(trimmedDate)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid date format or impossible calendar date. Expected YYYY-MM-DD (e.g. 2026-11-18)'
                    });
                }
                targetDate = trimmedDate;
            }
        }

        if (!targetDate) {
            const todayResult = await pool.query('SELECT CURRENT_DATE::TEXT AS today');
            targetDate = todayResult.rows[0].today;
        }

        const doctorResult = await pool.query(
            `SELECT id, name, specialization, is_available, availability_hours FROM doctors WHERE id = $1`,
            [id]
        );

        if (doctorResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        const doctor = doctorResult.rows[0];

        // Total tokens booked for this date
        const countResult = await pool.query(
            `SELECT COUNT(*) AS total_booked, COALESCE(MAX(token_number), 0) + 1 AS next_token 
             FROM tokens 
             WHERE doctor_id = $1 AND booking_date = $2`,
            [id, targetDate]
        );

        const totalBooked = parseInt(countResult.rows[0].total_booked, 10);
        const nextToken = parseInt(countResult.rows[0].next_token, 10);

        return res.status(200).json({
            success: true,
            data: {
                doctor_id: doctor.id,
                doctor_name: doctor.name,
                specialization: doctor.specialization,
                is_available: doctor.is_available,
                availability_hours: doctor.availability_hours,
                date: targetDate,
                total_booked: totalBooked,
                next_token_number: nextToken
            }
        });
    } catch (error) {
        console.error('Error fetching doctor queue status:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};