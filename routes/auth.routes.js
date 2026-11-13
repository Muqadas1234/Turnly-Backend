const express = require('express');
const router = express.Router();
const {
    signup,
    verifyOtp,
    resendOtp,
    login,
    getProfile,
    updateProfile,
} = require('../controllers/auth.controller');
const verifyToken = require('../middleware/auth');

router.post('/signup', signup);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);

router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);

module.exports = router;
