require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedAdmin() {
  const adminName = 'System Admin';
  const adminEmail = 'team.turnly@gmail.com';
  const adminPassword = 'AdminPassword123'; // Set your desired admin password here

  try {
    // 1. Hash the admin password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    // 2. Check if the user already exists in the database
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);

    if (existing.rows.length > 0) {
      // 3. If user exists, upgrade the role to 'admin' and ensure verified status
      await pool.query(
        `UPDATE users 
         SET role = 'admin', password_hash = $1, is_verified = true, name = $2 
         WHERE email = $3`,
        [passwordHash, adminName, adminEmail]
      );
      console.log('Existing user updated to Admin successfully!');
    } else {
      // 4. If user does not exist, insert a new admin record
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, is_verified)
         VALUES ($1, $2, $3, 'admin', true)`,
        [adminName, adminEmail, passwordHash]
      );
      console.log('Admin user created successfully!');
    }

    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Role: admin');
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    await pool.end();
  }
}

seedAdmin();