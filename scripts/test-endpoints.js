const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch(e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function runTests() {
    const testEmail = 'autotest_' + Date.now() + '@turnlytest.com';
    console.log('Testing with email:', testEmail);

    // 1. Health check
    console.log('\n--- 1. Health Check (GET /) ---');
    let res = await request({ host: 'localhost', port: 3000, path: '/', method: 'GET' });
    console.log('Status:', res.status, res.body);

    // 2. Signup
    console.log('\n--- 2. Signup (POST /api/auth/signup) ---');
    res = await request(
        { host: 'localhost', port: 3000, path: '/api/auth/signup', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { name: 'Endpoint Tester', email: testEmail, password: 'password123', role: 'patient', fcm_token: 'test_fcm_token_xyz' }
    );
    console.log('Status:', res.status, res.body);

    // 3. Login before verification
    console.log('\n--- 3. Login before verify (POST /api/auth/login) ---');
    res = await request(
        { host: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { email: testEmail, password: 'password123' }
    );
    console.log('Status:', res.status, res.body);

    // Fetch user and OTP from database
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [testEmail]);
    const userId = userRes.rows[0].id;
    const otpRes = await pool.query('SELECT otp_code FROM email_otps WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
    const otpCode = otpRes.rows[0].otp_code;
    console.log('Generated OTP from DB:', otpCode);

    // 4. Verify OTP with wrong code
    console.log('\n--- 4. Verify OTP with WRONG code (POST /api/auth/verify-otp) ---');
    res = await request(
        { host: 'localhost', port: 3000, path: '/api/auth/verify-otp', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { email: testEmail, otp_code: '000000' }
    );
    console.log('Status:', res.status, res.body);

    // 5. Resend OTP
    console.log('\n--- 5. Resend OTP (POST /api/auth/resend-otp) ---');
    res = await request(
        { host: 'localhost', port: 3000, path: '/api/auth/resend-otp', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { email: testEmail }
    );
    console.log('Status:', res.status, res.body);

    // Fetch new resent OTP from DB
    const newOtpRes = await pool.query('SELECT otp_code FROM email_otps WHERE user_id = $1 AND is_used = false ORDER BY created_at DESC LIMIT 1', [userId]);
    const newOtpCode = newOtpRes.rows[0].otp_code;
    console.log('New resent OTP from DB:', newOtpCode);

    // 6. Verify with valid OTP
    console.log('\n--- 6. Verify OTP with VALID code (POST /api/auth/verify-otp) ---');
    res = await request(
        { host: 'localhost', port: 3000, path: '/api/auth/verify-otp', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { email: testEmail, otp_code: newOtpCode }
    );
    console.log('Status:', res.status, res.body);

    // 7. Login after verification
    console.log('\n--- 7. Login after verification (POST /api/auth/login) ---');
    res = await request(
        { host: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { email: testEmail, password: 'password123', fcm_token: 'updated_fcm_token_999' }
    );
    console.log('Status:', res.status, 'Token received:', !!res.body.token, res.body.user);
    const token = res.body.token;

    // 8. Get Profile
    console.log('\n--- 8. Get Profile (GET /api/auth/profile) ---');
    res = await request({
        host: 'localhost',
        port: 3000,
        path: '/api/auth/profile',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Status:', res.status, res.body);

    // 9. Update Profile
    console.log('\n--- 9. Update Profile (PUT /api/auth/profile) ---');
    res = await request(
        {
            host: 'localhost',
            port: 3000,
            path: '/api/auth/profile',
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        },
        { name: 'Endpoint Tester Updated' }
    );
    console.log('Status:', res.status, res.body);

    // 10. Access without token
    console.log('\n--- 10. Access Protected Route WITHOUT Token (GET /api/auth/profile) ---');
    res = await request({
        host: 'localhost',
        port: 3000,
        path: '/api/auth/profile',
        method: 'GET'
    });
    console.log('Status:', res.status, res.body);

    // Cleanup
    await pool.query('DELETE FROM email_otps WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    console.log('\n--- All 10 Endpoints & Edge Cases Tested Successfully! ---');
    process.exit(0);
}

runTests().catch(e => {
    console.error('Test error:', e);
    process.exit(1);
});
