
const pool = require('../config/db');
const { notifyUser } = require('../services/notify');
const { HOSPITAL_MESSAGES } = require('./admin.controller');

// Register a hospital for the authenticated manager.
const registerHospital = async (req, res) => {
    try {
        const {
            name,
            hospital_type,
            address,
            city,
            phone,
            email,
            opd_timings,
            logo_url,
            manager_name,
            manager_email,
            manager_phone,
            manager_designation,
            license_doc_name,
            license_doc_size,
            license_doc_url,
            certificate_doc_name,
            certificate_doc_size,
            certificate_doc_url,
        } = req.body;

        // Required fields validation
        if (!name || !city || !manager_name || !manager_email) {
            return res.status(400).json({
                success: false,
                message: 'Hospital name, city, manager name, and manager email are required',
            });
        }

        const managerId = req.userId;
        const manager = await pool.query(
            `SELECT id, name, email, phone, role FROM users WHERE id = $1 AND is_verified = true`,
            [managerId]
        );
        if (!manager.rows[0] || manager.rows[0].role !== 'manager') {
            return res.status(403).json({ success: false, message: 'A verified manager account is required' });
        }

        const existing = await pool.query(
            `SELECT id, status FROM hospitals WHERE manager_id = $1 LIMIT 1`, [managerId]
        );
        if (existing.rows[0]) {
            return res.status(409).json({
                success: false,
                message: existing.rows[0].status === 'rejected'
                    ? 'Your previous registration was rejected. Please use resubmit.'
                    : 'You already have a hospital registration.',
                hospital_id: existing.rows[0].id,
                status: existing.rows[0].status,
            });
        }

        const inserted = await pool.query(
            `INSERT INTO hospitals (
                name,
                hospital_type,
                address,
                city,
                phone,
                email,
                opd_timings,
                logo_url,
                status,
                manager_id,
                manager_name,
                manager_email,
                manager_phone,
                manager_designation,
                license_doc_name,
                license_doc_size,
                license_doc_url,
                certificate_doc_name,
                certificate_doc_size,
                certificate_doc_url
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                'pending',
                $9,
                $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
            RETURNING *`,
            [
                name,
                hospital_type || 'Private',
                address || null,
                city,
                phone || manager_phone || null,
                email || manager_email || null,
                opd_timings || '9:00 AM - 8:00 PM',
                logo_url || null,
                managerId,
                manager_name || manager.rows[0].name,
                manager_email || manager.rows[0].email,
                manager_phone || manager.rows[0].phone || null,
                manager_designation || 'Medical Superintendent',
                license_doc_name || null,
                license_doc_size || null,
                license_doc_url || null,
                certificate_doc_name || null,
                certificate_doc_size || null,
                certificate_doc_url || null,
            ]
        );

        const hospital = inserted.rows[0];

        return res.status(201).json({
            success: true,
            message: 'Hospital registration submitted for approval',
            hospital,
        });

    } catch (error) {
        console.error('Register hospital error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error during hospital registration',
        });
    }
};


// Resubmit a rejected hospital registration
// This endpoint is for an authenticated manager.
const resubmitHospital = async (req, res) => {
    try {
        const managerId = req.userId;

        const existing = await pool.query(
            'SELECT * FROM hospitals WHERE manager_id = $1 LIMIT 1',
            [managerId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hospital registration not found',
            });
        }

        const current = existing.rows[0];

        if (current.status !== 'rejected') {
            return res.status(409).json({
                success: false,
                message: `A ${current.status} hospital cannot be resubmitted`,
            });
        }

        const {
            name,
            hospital_type,
            address,
            city,
            phone,
            email,
            opd_timings,
            logo_url,
            manager_name,
            manager_email,
            manager_phone,
            manager_designation,
            license_doc_name,
            license_doc_size,
            license_doc_url,
            certificate_doc_name,
            certificate_doc_size,
            certificate_doc_url,
        } = req.body;

        const updated = await pool.query(
            `UPDATE hospitals
             SET name = $1,
                 hospital_type = $2,
                 address = $3,
                 city = $4,
                 phone = $5,
                 email = $6,
                 opd_timings = $7,
                 logo_url = $8,
                 manager_name = $9,
                 manager_email = $10,
                 manager_phone = $11,
                 manager_designation = $12,
                 license_doc_name = $13,
                 license_doc_size = $14,
                 license_doc_url = $15,
                 certificate_doc_name = $16,
                 certificate_doc_size = $17,
                 certificate_doc_url = $18,
                 status = 'pending',
                 rejection_reason = NULL,
                 updated_at = NOW()
             WHERE id = $19
             RETURNING *`,
            [
                name ?? current.name,
                hospital_type ?? current.hospital_type,
                address ?? current.address,
                city ?? current.city,
                phone ?? current.phone,
                email ?? current.email,
                opd_timings ?? current.opd_timings,
                logo_url ?? current.logo_url,
                manager_name ?? current.manager_name,
                manager_email ?? current.manager_email,
                manager_phone ?? current.manager_phone,
                manager_designation ?? current.manager_designation,
                license_doc_name ?? current.license_doc_name,
                license_doc_size ?? current.license_doc_size,
                license_doc_url ?? current.license_doc_url,
                certificate_doc_name ?? current.certificate_doc_name,
                certificate_doc_size ?? current.certificate_doc_size,
                certificate_doc_url ?? current.certificate_doc_url,
                current.id,
            ]
        );

        return res.json({
            success: true,
            message: 'Hospital registration resubmitted for approval',
            hospital: updated.rows[0],
        });

    } catch (error) {
        console.error('Resubmit hospital error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error while resubmitting registration',
        });
    }
};


// Get the authenticated manager's hospital
const getMyHospital = async (req, res) => {
    try {
        const managerId = req.userId;

        const result = await pool.query(
            'SELECT * FROM hospitals WHERE manager_id = $1 LIMIT 1',
            [managerId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No hospital registered for this manager',
            });
        }

        return res.json({
            success: true,
            hospital: result.rows[0],
        });

    } catch (error) {
        console.error('Get my hospital error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching hospital',
        });
    }
};


// Update hospital status (admin: approved, rejected, suspended, pending)
const updateHospitalStatus = async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required',
            });
        }

        const { id } = req.params;
        const { status, rejection_reason, suspension_reason } = req.body;

        if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid hospital status',
            });
        }

        const result = await pool.query(
            `UPDATE hospitals
             SET status = $1,
                 rejection_reason = $2,
                 suspension_reason = $3,
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [
                status,
                status === 'rejected'
                    ? (rejection_reason || 'Please review your documents and resubmit.')
                    : null,
                status === 'suspended'
                    ? (suspension_reason || 'Temporarily suspended by Turnly admin.')
                    : null,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hospital not found',
            });
        }

        // Notify the manager if an account is linked to this hospital.
        const updatedHospital = result.rows[0];

        if (HOSPITAL_MESSAGES[status] && updatedHospital.manager_id) {
            await notifyUser(
                updatedHospital.manager_id,
                HOSPITAL_MESSAGES[status](updatedHospital)
            );
        }

        return res.json({
            success: true,
            message: `Hospital status updated to ${status}`,
            hospital: updatedHospital,
        });

    } catch (error) {
        console.error('Update hospital status error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error updating hospital status',
        });
    }
};


// Edit details of the manager's own hospital
const updateMyHospital = async (req, res) => {
    try {
        const b = req.body || {};

        const lat = b.latitude !== undefined && b.latitude !== null
            ? Number(b.latitude)
            : null;

        const lng = b.longitude !== undefined && b.longitude !== null
            ? Number(b.longitude)
            : null;

        if (
            (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) ||
            (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid latitude / longitude',
            });
        }

        const result = await pool.query(
            `UPDATE hospitals SET
                phone = COALESCE($1, phone),
                email = COALESCE($2, email),
                address = COALESCE($3, address),
                opd_timings = COALESCE($4, opd_timings),
                logo_url = COALESCE($5, logo_url),
                latitude = COALESCE($6, latitude),
                longitude = COALESCE($7, longitude),
                updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [
                b.phone ?? null,
                b.email ?? null,
                b.address ?? null,
                b.opd_timings ?? null,
                b.logo_url ?? null,
                lat,
                lng,
                req.hospital.id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Hospital not found',
            });
        }

        return res.json({
            success: true,
            message: 'Hospital updated',
            hospital: result.rows[0],
        });

    } catch (error) {
        console.error('Update my hospital error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error updating hospital',
        });
    }
};


module.exports = {
    registerHospital,
    resubmitHospital,
    getMyHospital,
    updateMyHospital,
    updateHospitalStatus,
};
