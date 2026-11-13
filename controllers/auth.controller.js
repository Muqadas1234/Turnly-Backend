const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendOtpEmail } = require('../config/email');
require('dotenv').config();

// generate 6 digit random otp
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// create jwt auth token
const signToken = (userId, role) => {
    return jwt.sign(
        { userId, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// register new user and send otp
const signup = async (req, res) => {
    try {
        const { name, email, password, role, fcm_token } = req.body;

        // validate inputs
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required',
            });
        }

        if (!['patient', 'manager'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role selection',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        // check if user exists
        const existing = await pool.query(
            'SELECT id, is_verified FROM users WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            const user = existing.rows[0];
            // if not verified yet, clear previous data to allow fresh signup
            if (!user.is_verified) {
                await pool.query('DELETE FROM email_otps WHERE user_id = $1', [user.id]);
                await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
            } else {
                return res.status(409).json({
                    success: false,
                    message: 'Email already exists',
                });
            }
        }

        // hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // insert user record
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role, fcm_token, is_verified)
             VALUES ($1, $2, $3, $4, $5, false)
             RETURNING id, name, email, role`,
            [name, email, passwordHash, role, fcm_token || null]
        );

        const newUser = result.rows[0];

        // create otp with 10 min expiration
        const otpCode = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            'INSERT INTO email_otps (user_id, otp_code, expires_at) VALUES ($1, $2, $3)',
            [newUser.id, otpCode, expiresAt]
        );

        // send email
        await sendOtpEmail(email, otpCode, name);

        return res.status(201).json({
            success: true,
            message: 'Verification code sent to your email',
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
            },
        });
    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({ success: false, message: 'Server error during signup' });
    }
};

// verify email otp code
const verifyOtp = async (req, res) => {
    try {
        const { email, otp_code } = req.body;

        if (!email || !otp_code) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required',
            });
        }

        // find user
        const userResult = await pool.query(
            'SELECT id, name, email, role FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = userResult.rows[0];

        // check otp validity
        const otpResult = await pool.query(
            `SELECT id FROM email_otps
             WHERE user_id = $1 AND otp_code = $2 AND expires_at > NOW() AND is_used = false
             ORDER BY created_at DESC LIMIT 1`,
            [user.id, otp_code]
        );

        if (otpResult.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired code' });
        }

        // mark otp as used and verify user
        await pool.query('UPDATE email_otps SET is_used = true WHERE id = $1', [otpResult.rows[0].id]);
        await pool.query('UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1', [user.id]);

        const token = signToken(user.id, user.role);

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({ success: false, message: 'Server error during verification' });
    }
};

// resend new otp
const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const userResult = await pool.query(
            'SELECT id, name, email, is_verified FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = userResult.rows[0];

        if (user.is_verified) {
            return res.status(400).json({ success: false, message: 'Account is already verified' });
        }

        // invalidate old unused otps
        await pool.query('UPDATE email_otps SET is_used = true WHERE user_id = $1 AND is_used = false', [user.id]);

        // generate new otp
        const otpCode = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            'INSERT INTO email_otps (user_id, otp_code, expires_at) VALUES ($1, $2, $3)',
            [user.id, otpCode, expiresAt]
        );

        await sendOtpEmail(user.email, otpCode, user.name);

        return res.status(200).json({ success: true, message: 'Code resent to your email' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        return res.status(500).json({ success: false, message: 'Server error while resending code' });
    }
};

// login with email and password
const login = async (req, res) => {
    try {
        const { email, password, fcm_token } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        // find user
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // check if user verified email
        if (!user.is_verified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before logging in',
                requiresVerification: true,
            });
        }

        // compare passwords
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // update fcm token if passed
        if (fcm_token) {
            await pool.query('UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2', [fcm_token, user.id]);
        }

        const token = signToken(user.id, user.role);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Server error during login' });
    }
};

// get logged in user profile
const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, hospital_id, created_at FROM users WHERE id = $1',
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Profile fetch error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// update user name
const updateProfile = async (req, res) => {
    try {
        const { name } = req.body;
        const result = await pool.query(
            'UPDATE users SET name = COALESCE($1, name), updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role',
            [name, req.userId]
        );

        return res.status(200).json({
            success: true,
            message: 'Profile updated',
            user: result.rows[0],
        });
    } catch (error) {
        console.error('Profile update error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { signup, verifyOtp, resendOtp, login, getProfile, updateProfile };
