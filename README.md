# Turnly Backend

RESTful API service for **Turnly** — Hospital Token & Queue Management System.

Built with Node.js, Express, PostgreSQL, and Nodemailer.

---

## Features

- **Authentication & Authorization**: JWT token-based auth with bcrypt password hashing.
- **Email OTP Verification**: Multi-step signup with 6-digit OTP delivery via Gmail SMTP.
- **PostgreSQL Database**: Relational schema for users, OTPs, hospitals, departments, doctors, and tokens.
- **FCM Push Notification Token Support**: Automatically stores FCM tokens for real-time mobile push notifications.
- **Automated Test Suite**: Built-in test script verifying 10 critical authentication flows.

---

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: PostgreSQL (hosted on Neon Cloud)
- **Database Client**: `pg` (node-postgres connection pool)
- **Authentication**: `jsonwebtoken` (JWT), `bcryptjs`
- **Mailing**: `nodemailer`
- **Security & Utilities**: `cors`, `dotenv`

---

## Project Structure

```text
Turnly-Backend/
├── config/
│   ├── db.js             # PostgreSQL connection pool with SSL
│   └── email.js          # Nodemailer SMTP transporter configuration
├── controllers/
│   └── auth.controller.js# Signup, OTP verification, resend, login, profile logic
├── middleware/
│   └── auth.js           # JWT authentication & route protection middleware
├── routes/
│   └── auth.routes.js    # Express route declarations
├── scripts/
│   ├── setup-db.js       # Database schema creation script
│   └── test-endpoints.js # Automated 10-step endpoint verification suite
├── .env.example          # Environment variables template
├── package.json          # Node.js dependencies and scripts
└── server.js             # Express application entry point
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Muqadas1234/Turnly-Backend.git
cd Turnly-Backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```env
PORT=3000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret_key
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password
```

### 4. Initialize Database Tables

```bash
node scripts/setup-db.js
```

### 5. Start the Server

```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

Server runs on: `http://localhost:3000`

---

## API Endpoints

### Public Routes

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Health check | None |
| `POST` | `/api/auth/signup` | Register new user & send OTP | `{ "name", "email", "password", "fcmToken" }` |
| `POST` | `/api/auth/verify-otp` | Verify 6-digit OTP code | `{ "email", "otp" }` |
| `POST` | `/api/auth/resend-otp` | Generate & resend new OTP | `{ "email" }` |
| `POST` | `/api/auth/login` | Authenticate user & get JWT | `{ "email", "password", "fcmToken" }` |

### Protected Routes (Requires `Authorization: Bearer <token>`)

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/profile` | Get current user profile | None |
| `PUT` | `/api/auth/profile` | Update profile information | `{ "name" }` |

---

## Running Automated Tests

Run the test suite to verify all auth endpoints against the database:

```bash
node scripts/test-endpoints.js
```

---

## License

ISC License.
