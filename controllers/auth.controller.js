const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendOtpEmail, sendResetEmail } = require('../config/email');
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
        const { name, email, password, role, fcm_token, phone } = req.body;

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
            `INSERT INTO users (name, email, password_hash, role, fcm_token, phone, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6, false)
             RETURNING id, name, email, role`,
            [name, email, passwordHash, role, fcm_token || null, phone || null]
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
             WHERE user_id = $1 AND otp_code = $2 AND expires_at > NOW() AND is_used = false AND purpose = 'verify'
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
            'SELECT id, name, email, phone, role, hospital_id, created_at FROM users WHERE id = $1',
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
        const { name, phone } = req.body;
        const result = await pool.query(
            'UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), updated_at = NOW() WHERE id = $3 RETURNING id, name, email, phone, role',
            [name || null, phone || null, req.userId]
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

// forgot password: email a 6 digit reset code (same response whether or not the email exists)
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const result = await pool.query('SELECT id, name, email FROM users WHERE email = $1 AND is_verified = true', [email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            await pool.query("UPDATE email_otps SET is_used = true WHERE user_id = $1 AND purpose = 'reset' AND is_used = false", [user.id]);
            const otpCode = generateOtp();
            await pool.query(
                "INSERT INTO email_otps (user_id, otp_code, purpose, expires_at) VALUES ($1, $2, 'reset', $3)",
                [user.id, otpCode, new Date(Date.now() + 10 * 60 * 1000)]
            );
            await sendResetEmail(user.email, otpCode, user.name);
        }

        return res.status(200).json({ success: true, message: 'If an account exists for this email, a reset code has been sent' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// reset password with the emailed code
const resetPassword = async (req, res) => {
    try {
        const { email, otp_code, new_password } = req.body;
        if (!email || !otp_code || !new_password) {
            return res.status(400).json({ success: false, message: 'Email, code and new password are required' });
        }
        if (new_password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired code' });
        }
        const userId = userResult.rows[0].id;

        const otpResult = await pool.query(
            `SELECT id FROM email_otps
             WHERE user_id = $1 AND otp_code = $2 AND purpose = 'reset' AND is_used = false AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [userId, otp_code]
        );
        if (otpResult.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired code' });
        }

        const passwordHash = await bcrypt.hash(new_password, await bcrypt.genSalt(10));
        await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
        await pool.query('UPDATE email_otps SET is_used = true WHERE id = $1', [otpResult.rows[0].id]);

        return res.status(200).json({ success: true, message: 'Password reset successfully. Please log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// change password while logged in
const changePassword = async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }
        if (new_password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

        const ok = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!ok) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

        const passwordHash = await bcrypt.hash(new_password, await bcrypt.genSalt(10));
        await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, req.userId]);
        return res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// save / refresh the phone's FCM token (call this whenever Firebase gives the app a new token)
const updateFcmToken = async (req, res) => {
    try {
        const { fcm_token } = req.body;
        if (!fcm_token) return res.status(400).json({ success: false, message: 'fcm_token is required' });
        // a token belongs to one account: remove it from anyone who logged in earlier on the same phone
        await pool.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = $1 AND id <> $2', [fcm_token, req.userId]);
        await pool.query('UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2', [fcm_token, req.userId]);
        return res.status(200).json({ success: true, message: 'Push token saved' });
    } catch (error) {
        console.error('FCM token error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { signup, verifyOtp, resendOtp, login, getProfile, updateProfile, forgotPassword, resetPassword, changePassword, updateFcmToken };
