const pool = require('../config/db');
const { sendApprovalEmail, sendRejectionEmail, sendSuspensionEmail } = require('../config/email');

// Fetch all hospitals with optional status filter and counts summary
exports.getHospitals = async (req, res) => {
    try {
        const { status } = req.query;

        // 1. Fetch count summary for pending, approved, and suspended
        const countsQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
                COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
                COUNT(*) FILTER (WHERE status = 'suspended') AS suspended_count,
                COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count
            FROM hospitals
        `;
        const countsResult = await pool.query(countsQuery);

        // 2. Query hospitals with manager details
        let query = `
            SELECT 
                h.id,
                h.name,
                h.address,
                h.city,
                h.phone,
                h.email,
                h.status,
                h.hospital_type AS type,
                h.opd_timings,
                h.rejection_reason AS rejection_note,
                h.license_doc_name,
                h.license_doc_size,
                h.document_name,
                h.document_type,
                h.certificate_doc_name,
                h.certificate_doc_size,
                (h.document_data IS NOT NULL) AS has_document,
                (h.certificate_data IS NOT NULL) AS has_certificate,
                (h.logo_data IS NOT NULL) AS has_logo,
                h.created_at,
                u.name AS manager_name,
                u.email AS manager_email
            FROM hospitals h
            LEFT JOIN users u ON h.manager_id = u.id
        `;
        const params = [];

        if (status && ['pending', 'approved', 'rejected', 'suspended'].includes(status.toLowerCase())) {
            query += ` WHERE h.status = $1`;
            params.push(status.toLowerCase());
        }

        query += ` ORDER BY h.created_at DESC`;

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            counts: {
                pending: parseInt(countsResult.rows[0].pending_count) || 0,
                approved: parseInt(countsResult.rows[0].approved_count) || 0,
                suspended: parseInt(countsResult.rows[0].suspended_count) || 0,
                rejected: parseInt(countsResult.rows[0].rejected_count) || 0
            },
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching hospitals:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching hospitals'
        });
    }
};

// Fetch single hospital details by ID
exports.getHospitalById = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                h.id,
                h.name,
                h.address,
                h.city,
                h.phone,
                h.email,
                h.status,
                h.hospital_type AS type,
                h.opd_timings,
                h.rejection_reason AS rejection_note,
                h.license_doc_name,
                h.license_doc_size,
                h.document_name,
                h.document_type,
                h.certificate_doc_name,
                h.certificate_doc_size,
                (h.document_data IS NOT NULL) AS has_document,
                (h.certificate_data IS NOT NULL) AS has_certificate,
                (h.logo_data IS NOT NULL) AS has_logo,
                h.created_at,
                u.name AS manager_name,
                u.email AS manager_email
            FROM hospitals h
            LEFT JOIN users u ON h.manager_id = u.id
            WHERE h.id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hospital not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching hospital details:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Approve a hospital registration
exports.approveHospital = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE hospitals 
             SET status = 'approved', updated_at = NOW() 
             WHERE id = $1 
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hospital not found'
            });
        }

        const hospital = result.rows[0];

        // Always send email to the registered user's login email (users table)
        let managerEmail = null;
        let managerName = hospital.manager_name || 'Manager';

        if (hospital.manager_id) {
            const userRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [hospital.manager_id]);
            if (userRes.rows[0] && userRes.rows[0].email) {
                managerEmail = userRes.rows[0].email;
                managerName = userRes.rows[0].name || managerName;
            }
        }
        if (!managerEmail) {
            managerEmail = hospital.manager_email;
        }

        if (managerEmail) {
            try {
                await sendApprovalEmail(managerEmail.trim(), hospital.name, managerName);
                console.log(`Approval email successfully sent to ${managerEmail}`);
            } catch (err) {
                console.error('Error sending approval email:', err.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Hospital approved successfully',
            data: hospital
        });
    } catch (error) {
        console.error('Error approving hospital:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Reject a hospital registration with an optional reason
exports.rejectHospital = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionNote } = req.body || {};

        const result = await pool.query(
            `UPDATE hospitals 
             SET status = 'rejected', rejection_reason = $1, updated_at = NOW() 
             WHERE id = $2 
             RETURNING *`,
            [rejectionNote || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hospital not found'
            });
        }

        const hospital = result.rows[0];

        // Always send email to the registered user's login email (users table)
        let managerEmail = null;
        let managerName = hospital.manager_name || 'Manager';

        if (hospital.manager_id) {
            const userRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [hospital.manager_id]);
            if (userRes.rows[0] && userRes.rows[0].email) {
                managerEmail = userRes.rows[0].email;
                managerName = userRes.rows[0].name || managerName;
            }
        }
        if (!managerEmail) {
            managerEmail = hospital.manager_email;
        }

        if (managerEmail) {
            try {
                await sendRejectionEmail(managerEmail.trim(), hospital.name, managerName, rejectionNote);
                console.log(`Rejection email successfully sent to ${managerEmail}`);
            } catch (err) {
                console.error('Error sending rejection email:', err.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Hospital registration rejected',
            data: hospital
        });
    } catch (error) {
        console.error('Error rejecting hospital:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Suspend an approved hospital
exports.suspendHospital = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};

        const result = await pool.query(
            `UPDATE hospitals 
             SET status = 'suspended', updated_at = NOW() 
             WHERE id = $1 
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hospital not found'
            });
        }

        const hospital = result.rows[0];

        // Always send email to the registered user's login email (users table)
        let managerEmail = null;
        let managerName = hospital.manager_name || 'Manager';

        if (hospital.manager_id) {
            const userRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [hospital.manager_id]);
            if (userRes.rows[0] && userRes.rows[0].email) {
                managerEmail = userRes.rows[0].email;
                managerName = userRes.rows[0].name || managerName;
            }
        }
        if (!managerEmail) {
            managerEmail = hospital.manager_email;
        }

        if (managerEmail) {
            try {
                await sendSuspensionEmail(managerEmail.trim(), hospital.name, managerName, reason);
                console.log(`Suspension email successfully sent to ${managerEmail}`);
            } catch (err) {
                console.error('Error sending suspension email:', err.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Hospital suspended successfully',
            data: hospital
        });
    } catch (error) {
        console.error('Error suspending hospital:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Fetch overall platform statistics
exports.getPlatformStats = async (req, res) => {
    try {
        const totalHospitals = await pool.query(`SELECT COUNT(*) FROM hospitals WHERE status = 'approved'`);
        const totalPatients = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'patient'`);
        const totalTokensToday = await pool.query(`
            SELECT COUNT(*) FROM tokens 
            WHERE DATE(created_at) = CURRENT_DATE
        `);
        const activeQueues = await pool.query(`
            SELECT COUNT(DISTINCT doctor_id) FROM tokens 
            WHERE status IN ('waiting', 'serving')
        `);

        // Tokens issued per hospital for bar chart
        const tokensPerHospital = await pool.query(`
            SELECT h.name, COUNT(t.id) AS token_count
            FROM hospitals h
            LEFT JOIN tokens t ON h.id = t.hospital_id AND DATE(t.created_at) = CURRENT_DATE
            WHERE h.status = 'approved'
            GROUP BY h.id, h.name
            ORDER BY token_count DESC
            LIMIT 5
        `);

        return res.status(200).json({
            success: true,
            data: {
                totalHospitals: parseInt(totalHospitals.rows[0].count) || 0,
                totalPatients: parseInt(totalPatients.rows[0].count) || 0,
                tokensToday: parseInt(totalTokensToday.rows[0].count) || 0,
                activeQueues: parseInt(activeQueues.rows[0].count) || 0,
                tokensPerHospital: tokensPerHospital.rows
            }
        });
    } catch (error) {
        console.error('Error fetching platform stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Permanently delete a hospital (suspended or rejected or any)
exports.deleteHospital = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        await client.query('BEGIN');

        // Check if hospital exists
        const checkRes = await client.query('SELECT id, name, manager_id FROM hospitals WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Hospital not found'
            });
        }
        const hospital = checkRes.rows[0];

        // 1. Unlink hospital from any users
        await client.query('UPDATE users SET hospital_id = NULL WHERE hospital_id = $1', [id]);

        // 2. Delete tokens referencing this hospital
        await client.query('DELETE FROM tokens WHERE hospital_id = $1', [id]);

        // 3. Delete hospital (cascades to departments, doctors, token_counters)
        await client.query('DELETE FROM hospitals WHERE id = $1', [id]);

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: `Hospital "${hospital.name}" permanently deleted successfully`,
            data: { id: hospital.id }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting hospital:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while deleting hospital'
        });
    } finally {
        client.release();
    }
};

// Fetch platform hospital managers with optional status & search filter
exports.getManagers = async (req, res) => {
    try {
        const { status, search } = req.query;

        let query = `
            SELECT 
                u.id,
                u.name,
                u.email,
                u.phone,
                u.role,
                u.created_at,
                h.id AS hospital_id,
                h.name AS hospital_name,
                h.status AS hospital_status
            FROM users u
            LEFT JOIN hospitals h ON (u.hospital_id = h.id OR h.manager_id = u.id)
            WHERE u.role = 'manager'
        `;
        const params = [];

        if (status && ['approved', 'pending', 'rejected', 'suspended'].includes(status.toLowerCase())) {
            params.push(status.toLowerCase());
            query += ` AND LOWER(h.status) = $${params.length}`;
        }

        if (search && search.trim().length > 0) {
            params.push(`%${search.trim().toLowerCase()}%`);
            query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(COALESCE(u.phone, '')) LIKE $${params.length} OR LOWER(COALESCE(h.name, '')) LIKE $${params.length})`;
        }

        query += ` ORDER BY u.created_at DESC`;

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching managers:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching managers'
        });
    }
};

// Alias for backwards compatibility
exports.getUsers = exports.getManagers;