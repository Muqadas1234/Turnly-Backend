# Turnly Backend

REST + WebSocket API for **Turnly - Hospital Token & Queue Management**.
Node.js, Express 5, PostgreSQL, JWT auth, email OTP, optional FCM push.

Three roles share one API: **patient**, **manager** (hospital) and **admin** (platform).

---

## What's new in this version

| Area | Added |
| :--- | :--- |
| Patient browsing | Approved hospitals (search, city, nearest-first), departments, doctors with tokens left |
| Token booking | Atomic token numbers, doctor + department daily limits, family members, priority request |
| Live queue | Position + wait estimate, WebSocket updates, "turn is near" notification |
| Manager | Doctors CRUD with schedule, queue control (Call Next / Complete / Skip / Recall / Priority), dashboard stats, edit OPD hours |
| Admin | Hospital list with tab counts, review, bulk approve, platform stats |
| Account | Forgot / reset / change password, phone number, FCM token endpoint |
| Notifications | In-app list + WebSocket + optional FCM push |
| AI guide | Symptoms -> suggested department (Gemini, with offline fallback) |
| Security fixes | Department write routes are now manager-only and limited to the manager's own hospital; rate limiting on auth routes; hospital re-registration guard |

Existing endpoints (`/api/auth/*`, `/api/hospitals/register|resubmit|my-hospital|:id/status`, `/api/departments/*`) keep the same URLs and request fields.

---

## Setup

```bash
npm install
cp .env.example .env        # fill DATABASE_URL, JWT_SECRET, EMAIL_USER, EMAIL_PASS
npm run setup-db            # creates / upgrades tables (safe to re-run)
npm run seed                # optional demo data (see below)
npm run create-admin -- admin@turnly.app "StrongPass1" "Turnly Admin"
npm run dev                 # or: npm start
```

Server: `http://localhost:3000` - health check: `GET /health`.
For a local PostgreSQL (no SSL) add `DB_SSL=false` to `.env`.

`npm run seed` creates (password `Password123`): `admin@turnly.app`, `manager1@turnly.app` (City General Hospital, Karachi),
`manager2@turnly.app` (Shifa Care Clinic, Lahore), `patient@turnly.app` - hospitals are already approved, with departments and doctors.

`npm test` runs the unit tests for the queue and date logic (no database needed).

---

## Conventions

* JSON in / out, snake_case fields. Success: `{ "success": true, ... }`. Error: `{ "success": false, "message": "...", "code": "OPTIONAL_CODE" }`.
* Protected routes need `Authorization: Bearer <token>` (token from `verify-otp` or `login`).
* Dates are `YYYY-MM-DD` (hospital timezone, `APP_TIMEZONE`). Times are 24h `HH:MM`.
* Token statuses: `waiting` -> `serving` -> `done`, or `skipped` / `cancelled`.

Useful error codes: `DAILY_LIMIT_REACHED`, `DEPARTMENT_LIMIT_REACHED`, `ALREADY_BOOKED`, `OPD_CLOSED`, `DOCTOR_NOT_AVAILABLE`,
`HOSPITAL_NOT_APPROVED`, `NO_HOSPITAL`, `QUEUE_EMPTY`, `INVALID_STATE`.

---

## API

### Auth (`/api/auth`)
| Method | Endpoint | Body | Notes |
| :--- | :--- | :--- | :--- |
| POST | `/signup` | `name, email, password, role (patient/manager), phone?, fcm_token?` | sends OTP email |
| POST | `/verify-otp` | `email, otp_code` | returns `token` |
| POST | `/resend-otp` | `email` | |
| POST | `/login` | `email, password, fcm_token?` | returns `token` |
| POST | `/forgot-password` | `email` | emails a 6-digit reset code |
| POST | `/reset-password` | `email, otp_code, new_password` | |
| GET / PUT | `/profile` | `name?, phone?` | |
| PUT | `/change-password` | `current_password, new_password` | |
| PUT | `/fcm-token` | `fcm_token` | call whenever Firebase gives the app a new token |

### Patient: hospitals, departments, doctors
| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| GET | `/api/hospitals?search=&city=&lat=&lng=&page=&limit=` | approved only; `lat`+`lng` sorts nearest first (`distance_km`) |
| GET | `/api/hospitals/cities` | for the city chips |
| GET | `/api/hospitals/:id` | |
| GET | `/api/hospitals/:id/departments` | |
| GET | `/api/hospitals/:id/doctors?department_id=&search=&date=` | includes `tokens_left` |
| GET | `/api/doctors/:id?date=` | availability + live queue summary (`now_serving`, `waiting`, estimate) |

### Patient: tokens, family, notifications, AI
| Method | Endpoint | Body / notes |
| :--- | :--- | :--- |
| POST | `/api/tokens` | `doctor_id, date?, family_member_id?, priority_category? (elderly/disabled/pregnant/urgent), notes?` |
| GET | `/api/tokens/my?scope=active\|history` | |
| GET | `/api/tokens/:id` | token + `live`: `ahead_count`, `eta_minutes`, `now_serving`, mini `queue` |
| POST | `/api/tokens/:id/cancel` | only while `waiting` |
| GET / POST / PUT / DELETE | `/api/family`, `/api/family/:id` | `name, age, relation` (max 10) |
| GET | `/api/notifications` | list + `unread_count` |
| PUT | `/api/notifications/read-all`, `/api/notifications/:id/read` | |
| POST | `/api/ai/department-guide` | `{ message }` -> `{ department, reason, emergency, disclaimer }` |

### Manager (role `manager`)
| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| POST | `/api/hospitals/register` | verified manager JWT required; creates one manager-linked submission with status `pending` |
| PUT | `/api/hospitals/resubmit` | authenticated manager; rejected registrations only |
| GET | `/api/hospitals/my-hospital` | status, rejection / suspension reason |
| PATCH | `/api/hospitals/my-hospital` | `phone, email, address, opd_timings, logo_url, latitude, longitude` |
| GET / POST / PUT / PATCH / DELETE | `/api/departments`, `/api/departments/:id`, `/:id/toggle` | |
| GET | `/api/doctors?department_id=&search=` | own hospital |
| POST | `/api/doctors` | `name, department_id, specialization?, qualification?, experience_years?, schedule_days[], schedule_from, schedule_to, daily_token_limit, room?, photo_url?` |
| PUT / PATCH / DELETE | `/api/doctors/:id`, `/:id/toggle` | doctors with token history can only be hidden |
| GET | `/api/queue/stats?date=` | dashboard numbers, per-doctor queues, tokens by hour |
| GET | `/api/queue/:doctorId?date=` | now serving, waiting (priority first), skipped, counts |
| POST | `/api/queue/:doctorId/call-next` | completes the current patient, calls the next, notifies them |
| POST | `/api/queue/tokens/:id/complete` \| `/skip` \| `/recall` \| `/cancel` | |
| PATCH | `/api/queue/tokens/:id/priority` | `{ approved: true/false }` |

Queue routes need an **approved** hospital. Manager registration must happen after manager signup + email OTP verification; the JWT user ID is stored in `hospitals.manager_id`, so the manager can reliably fetch their own pending/rejected/approved registration. Existing legacy registrations with `manager_id = NULL` cannot be automatically associated; link them manually after verifying ownership.

### Admin (role `admin`)
| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| GET | `/api/admin/hospitals?status=&search=&page=` | returns `counts` for the Pending / Approved / Suspended tabs |
| GET | `/api/admin/hospitals/:id` | full registration for the review screen |
| PATCH | `/api/hospitals/:id/status` | `{ status: approved/rejected/suspended/pending, rejection_reason?, suspension_reason? }` - notifies the manager |
| POST | `/api/admin/hospitals/bulk-approve` | `{ ids: [1,2] }` |
| GET | `/api/admin/stats?date=` | hospitals, tokens today, active queues, patients, per-hospital bars, tokens by hour |

---

## Live queue (WebSocket)

Connect with the same JWT: `ws://HOST:PORT/ws?token=<JWT>`

```jsonc
// client -> server
{ "type": "subscribe", "doctor_id": 12, "date": "2026-11-15" }   // also "unsubscribe", "ping"

// server -> client
{ "event": "token.updated", "data": { "id": 5, "status": "waiting", "ahead_count": 2, "eta_minutes": 20 } }  // to the token's owner
{ "event": "queue.updated", "data": { "doctor_id": 12, "date": "...", "now_serving": 9, "waiting_count": 6 } } // to subscribers
{ "event": "notification",  "data": { "title": "...", "body": "..." } }
```

Patients with a token on a queue, the hospital's manager and admins may subscribe. Without WebSocket the app can poll `GET /api/tokens/:id`.

## Push notifications (optional)

Add a Firebase service account (`FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`) to send phone pushes.
The Flutter app sends its token with `login` or `PUT /api/auth/fcm-token`. Notification types: `token_booked`, `turn_near`
(when `NOTIFY_WHEN_AHEAD` patients are ahead), `token_called`, `token_skipped`, `token_cancelled`, `priority_approved|rejected`,
`hospital_approved|rejected|suspended`.

## How booking stays correct

* The token number comes from one atomic upsert on `token_counters` - two patients booking at the same moment can never get the same number, and the doctor's `daily_token_limit` is enforced in the same statement.
* The department row is locked during booking, so the department's `daily_token_limit` cannot be overshot.
* A unique index stops the same person holding two live tokens with one doctor on one day.
* Waiting estimate = average consultation time x patients ahead. The average updates from real consultation durations.
* Tokens from past days that were never processed are closed automatically every 10 minutes.

## Project structure

```text
server.js                  app + HTTP server + WebSocket + cleanup job
config/                    db.js (pg pool), email.js (nodemailer)
middleware/                auth.js (JWT), role.js (roles, manager's hospital), rateLimit.js
controllers/               auth, hospital, department, browse, doctor, token, queue, family, notification, admin, ai
routes/                    one file per controller
services/                  token.service, queue.service, stats.service, notify, push (FCM), realtime (WebSocket), ai.service
utils/                     http (AppError), db (transactions), dates, queue (pure logic)
scripts/                   setup-db, seed-demo, create-admin, test-endpoints (original auth test)
tests/                     unit tests (npm test)
```

## Notes

* Keep `.env` and `serviceAccountKey.json` out of git and out of shared zips.
* The in-memory rate limiter is per server instance; use Redis if you run several instances.
* Existing `tokens.status` values from older data should be `waiting`, `serving`, `done`, `skipped` or `cancelled`.

## License

ISC
