const pool = require('../config/db');

// Helper to resolve hospital_id for the authenticated manager
const resolveHospitalId = async (req) => {
    if (req.query.hospitalId) return parseInt(req.query.hospitalId, 10);
    if (req.body && req.body.hospital_id) return parseInt(req.body.hospital_id, 10);

    const userRes = await pool.query('SELECT hospital_id FROM users WHERE id = $1', [req.userId]);
    if (userRes.rows.length > 0 && userRes.rows[0].hospital_id) {
        return userRes.rows[0].hospital_id;
    }

    const hospRes = await pool.query('SELECT id FROM hospitals WHERE manager_id = $1 LIMIT 1', [req.userId]);
    return hospRes.rows.length > 0 ? hospRes.rows[0].id : null;
};

// Write operations must only ever touch the logged-in manager's OWN hospital (ignore any hospital id sent by the client)
const ownHospitalId = async (req) => {
    const r = await pool.query('SELECT id FROM hospitals WHERE manager_id = $1 LIMIT 1', [req.userId]);
    return r.rows.length > 0 ? r.rows[0].id : null;
};

// List departments for a hospital (with doctor count and optional search)
const getDepartments = async (req, res) => {
    try {
        const hospitalId = await resolveHospitalId(req);
        if (!hospitalId) {
            return res.status(404).json({ success: false, message: 'Hospital not found for user' });
        }

        // managers / admins see everything; patients only see active departments of approved hospitals
        const hosp = await pool.query('SELECT manager_id, status FROM hospitals WHERE id = $1', [hospitalId]);
        if (hosp.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Hospital not found' });
        }
        const isStaff = req.userRole === 'admin' || hosp.rows[0].manager_id === req.userId;
        if (!isStaff && hosp.rows[0].status !== 'approved') {
            return res.status(404).json({ success: false, message: 'Hospital not found' });
        }
        const activeClause = isStaff ? '' : 'AND d.is_active = true';

        const search = (req.query.search || '').trim();
        const params = [hospitalId];
        let searchClause = '';
        if (search) {
            params.push(`%${search}%`);
            searchClause = `AND LOWER(d.name) LIKE LOWER($2)`;
        }

        const result = await pool.query(
            `SELECT
                d.id,
                d.hospital_id,
                d.name,
                d.description,
                d.daily_token_limit,
                d.is_active,
                d.icon_key,
                d.created_at,
                d.updated_at,
                COUNT(doc.id)::INTEGER AS doctor_count
             FROM departments d
             LEFT JOIN doctors doc ON doc.department_id = d.id
             WHERE d.hospital_id = $1 ${activeClause} ${searchClause}
             GROUP BY d.id
             ORDER BY d.created_at ASC, d.id ASC`,
            params
        );

        return res.json({
            success: true,
            departments: result.rows,
        });
    } catch (error) {
        console.error('Get departments error:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching departments' });
    }
};

// Create a new department
const createDepartment = async (req, res) => {
    try {
        const hospitalId = await ownHospitalId(req);
        if (!hospitalId) {
            return res.status(404).json({ success: false, message: 'Hospital not found for user' });
        }

        const { name, description, daily_token_limit, is_active, icon_key } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Department name is required' });
        }

        const result = await pool.query(
            `INSERT INTO departments (hospital_id, name, description, daily_token_limit, is_active, icon_key)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *, 0::INTEGER AS doctor_count`,
            [
                hospitalId,
                name.trim(),
                description ? description.trim() : null,
                daily_token_limit ? parseInt(daily_token_limit, 10) : 50,
                is_active !== undefined ? Boolean(is_active) : true,
                icon_key || 'general',
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Department created successfully',
            department: result.rows[0],
        });
    } catch (error) {
        console.error('Create department error:', error);
        return res.status(500).json({ success: false, message: 'Server error creating department' });
    }
};

// Toggle department active status
const toggleDepartment = async (req, res) => {
    try {
        const hospitalId = await ownHospitalId(req);
        const { id } = req.params;
        const { is_active } = req.body;

        const result = await pool.query(
            `UPDATE departments
             SET is_active = COALESCE($1, NOT is_active),
                 updated_at = NOW()
             WHERE id = $2 AND hospital_id = $3
             RETURNING *`,
            [is_active !== undefined ? Boolean(is_active) : null, id, hospitalId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        return res.json({
            success: true,
            message: 'Department status updated',
            department: result.rows[0],
        });
    } catch (error) {
        console.error('Toggle department error:', error);
        return res.status(500).json({ success: false, message: 'Server error updating department status' });
    }
};

// Update department details
const updateDepartment = async (req, res) => {
    try {
        const hospitalId = await ownHospitalId(req);
        const { id } = req.params;
        const { name, description, daily_token_limit, is_active, icon_key } = req.body;

        const result = await pool.query(
            `UPDATE departments
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 daily_token_limit = COALESCE($3, daily_token_limit),
                 is_active = COALESCE($4, is_active),
                 icon_key = COALESCE($5, icon_key),
                 updated_at = NOW()
             WHERE id = $6 AND hospital_id = $7
             RETURNING *`,
            [
                name ? name.trim() : null,
                description !== undefined ? description : null,
                daily_token_limit ? parseInt(daily_token_limit, 10) : null,
                is_active !== undefined ? Boolean(is_active) : null,
                icon_key || null,
                id,
                hospitalId,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        return res.json({
            success: true,
            message: 'Department updated successfully',
            department: result.rows[0],
        });
    } catch (error) {
        console.error('Update department error:', error);
        return res.status(500).json({ success: false, message: 'Server error updating department' });
    }
};

// Delete department
const deleteDepartment = async (req, res) => {
    try {
        const hospitalId = await ownHospitalId(req);
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM departments WHERE id = $1 AND hospital_id = $2 RETURNING id',
            [id, hospitalId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        return res.json({
            success: true,
            message: 'Department deleted successfully',
        });
    } catch (error) {
        console.error('Delete department error:', error);
        return res.status(500).json({ success: false, message: 'Server error deleting department' });
    }
};

module.exports = {
    getDepartments,
    createDepartment,
    toggleDepartment,
    updateDepartment,
    deleteDepartment,
};
