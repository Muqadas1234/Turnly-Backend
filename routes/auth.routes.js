const express = require('express');
const router = express.Router();
const {
    signup, verifyOtp, resendOtp, login, getProfile, updateProfile,
    forgotPassword, resetPassword, changePassword, updateFcmToken,
} = require('../controllers/auth.controller');
const verifyToken = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// brute-force protection on credential / OTP endpoints (20 tries per 15 min per IP)
const limited = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/signup', limited, signup);
router.post('/verify-otp', limited, verifyOtp);
router.post('/resend-otp', limited, resendOtp);
router.post('/login', limited, login);
router.post('/forgot-password', limited, forgotPassword);
router.post('/reset-password', limited, resetPassword);

router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);
router.put('/change-password', verifyToken, limited, changePassword);
router.put('/fcm-token', verifyToken, updateFcmToken);

module.exports = router;
