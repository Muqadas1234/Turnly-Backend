const pool = require('../config/db');

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
            query += ` AND (LOWER(h.name) LIKE $${params.length} OR LOWER(h.city) LIKE $${params.length} OR LOWER(h.address) LIKE $${params.length})`;
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
