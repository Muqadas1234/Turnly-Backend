const pool = require('../config/db');

const doctors = [
  // 1. Dermatology (dept: 14)
  { deptId: 14, name: 'Dr. Ayesha Khan', spec: 'Skin & Laser Specialist', qual: 'MBBS, FCPS (Dermatology)', exp: 8, room: 'Room 101', limit: 30, from: '09:00', to: '14:00', avg: 10 },
  { deptId: 14, name: 'Dr. Tariq Mahmood', spec: 'Clinical Dermatologist', qual: 'MBBS, MCPS (Dermatology)', exp: 12, room: 'Room 102', limit: 35, from: '10:00', to: '16:00', avg: 10 },
  { deptId: 14, name: 'Dr. Sana Javed', spec: 'Cosmetic Dermatologist', qual: 'MBBS, D.Derm (UK)', exp: 6, room: 'Room 103', limit: 25, from: '14:00', to: '19:00', avg: 12 },
  { deptId: 14, name: 'Dr. Bilal Siddiqui', spec: 'Hair & Scalp Specialist', qual: 'MBBS, FCPS (Dermatology)', exp: 10, room: 'Room 104', limit: 30, from: '11:00', to: '17:00', avg: 10 },

  // 2. Cardiology (dept: 15)
  { deptId: 15, name: 'Dr. Farhan Ali', spec: 'Interventional Cardiologist', qual: 'MBBS, FCPS (Cardiology)', exp: 14, room: 'Room 201', limit: 25, from: '09:00', to: '14:00', avg: 15 },
  { deptId: 15, name: 'Dr. Nida Fatima', spec: 'Consultant Cardiologist', qual: 'MBBS, MRCP (UK)', exp: 9, room: 'Room 202', limit: 30, from: '10:00', to: '15:00', avg: 12 },
  { deptId: 15, name: 'Dr. Kamran Shah', spec: 'Heart Failure & Rhythm Specialist', qual: 'MBBS, Diplomat American Board', exp: 16, room: 'Room 203', limit: 20, from: '12:00', to: '17:00', avg: 15 },
  { deptId: 15, name: 'Dr. Zainab Raza', spec: 'Preventive Cardiologist', qual: 'MBBS, FCPS (Cardiology)', exp: 7, room: 'Room 204', limit: 30, from: '15:00', to: '20:00', avg: 10 },

  // 3. General Medicine (dept: 16)
  { deptId: 16, name: 'Dr. Muhammad Rizwan', spec: 'Consultant Physician', qual: 'MBBS, FCPS (Internal Medicine)', exp: 11, room: 'Room 301', limit: 40, from: '08:30', to: '14:00', avg: 10 },
  { deptId: 16, name: 'Dr. Hina Aslam', spec: 'General Physician & Diabetologist', qual: 'MBBS, MRCP (Medicine)', exp: 8, room: 'Room 302', limit: 35, from: '09:00', to: '15:00', avg: 10 },
  { deptId: 16, name: 'Dr. Usman Ghani', spec: 'Internal Medicine Specialist', qual: 'MBBS, MCPS (Medicine)', exp: 15, room: 'Room 303', limit: 40, from: '11:00', to: '17:00', avg: 8 },
  { deptId: 16, name: 'Dr. Sadia Munir', spec: 'Family Medicine & General Health', qual: 'MBBS, FCPS (Medicine)', exp: 9, room: 'Room 304', limit: 35, from: '14:00', to: '20:00', avg: 10 },
  { deptId: 16, name: 'Dr. Asad Ullah', spec: 'Critical Care & General Physician', qual: 'MBBS, MD (Medicine)', exp: 12, room: 'Room 305', limit: 30, from: '16:00', to: '21:00', avg: 10 },

  // 4. Dental (dept: 17)
  { deptId: 17, name: 'Dr. Omar Farooq', spec: 'Oral & Maxillofacial Surgeon', qual: 'BDS, RDS, FCPS', exp: 10, room: 'Room 401', limit: 25, from: '09:00', to: '14:00', avg: 15 },
  { deptId: 17, name: 'Dr. Mehwish Akram', spec: 'Orthodontist (Braces Specialist)', qual: 'BDS, M.Sc (Orthodontics)', exp: 7, room: 'Room 402', limit: 20, from: '10:00', to: '15:00', avg: 15 },
  { deptId: 17, name: 'Dr. Hamza Sheikh', spec: 'Cosmetic & Restorative Dentist', qual: 'BDS, RDS, C-Implant', exp: 5, room: 'Room 403', limit: 25, from: '14:00', to: '19:00', avg: 12 },
  { deptId: 17, name: 'Dr. Rabia Qureshi', spec: 'Root Canal & Gum Specialist', qual: 'BDS, MCPS (Periodontics)', exp: 8, room: 'Room 404', limit: 20, from: '16:00', to: '21:00', avg: 15 },

  // 5. Gynecology (dept: 18)
  { deptId: 18, name: 'Dr. Shazia Batool', spec: 'Senior Gynecologist & Obstetrician', qual: 'MBBS, FCPS (Obs & Gynae)', exp: 15, room: 'Room 501', limit: 30, from: '09:00', to: '14:00', avg: 12 },
  { deptId: 18, name: 'Dr. Maryam Naveed', spec: 'Maternal & Fetal Medicine Specialist', qual: 'MBBS, MRCOG (UK)', exp: 12, room: 'Room 502', limit: 25, from: '10:00', to: '15:00', avg: 15 },
  { deptId: 18, name: 'Dr. Bushra Parveen', spec: 'Consultant Obstetrician', qual: 'MBBS, FCPS (Obs & Gynae)', exp: 9, room: 'Room 503', limit: 30, from: '11:00', to: '16:00', avg: 10 },
  { deptId: 18, name: 'Dr. Fatima Zahra', spec: 'Infertility & Laparoscopic Surgeon', qual: 'MBBS, MCPS (Obs & Gynae)', exp: 7, room: 'Room 504', limit: 25, from: '14:00', to: '19:00', avg: 12 },
  { deptId: 18, name: 'Dr. Amna Tahir', spec: 'Women Health & Ultrasound Specialist', qual: 'MBBS, DGO', exp: 11, room: 'Room 505', limit: 30, from: '15:00', to: '20:00', avg: 10 }
];

async function seed() {
  const hospitalId = 33;
  // Clean dummy test doctors ABC and DEF
  await pool.query("DELETE FROM doctors WHERE hospital_id = $1 AND name IN ('ABC', 'DEF')", [hospitalId]);

  let added = 0;
  for (const d of doctors) {
    await pool.query(
      `INSERT INTO doctors 
       (hospital_id, department_id, name, specialization, qualification, experience_years, 
        avg_consult_minutes, is_available, schedule_days, schedule_from, schedule_to, daily_token_limit, room)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, ARRAY['Mon','Tue','Wed','Thu','Fri','Sat'], $8, $9, $10, $11)`,
      [hospitalId, d.deptId, d.name, d.spec, d.qual, d.exp, d.avg, d.from, d.to, d.limit, d.room]
    );
    added++;
  }
  console.log(`Successfully added ${added} doctors to Hospital 33!`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Error inserting doctors:', err);
  process.exit(1);
});
