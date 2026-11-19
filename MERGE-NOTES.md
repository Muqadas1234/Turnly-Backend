# Turnly combined backend - integration notes

This folder contains the consolidated backend assembled from the uploaded `full-backend` source and the friend repository's `main`, `feature/patient-module`, and `feature/patient-booking` branches.

## Conflict resolutions applied

- Kept the expanded backend modules: hospital registration/management, departments, doctors and schedules, patient browsing, atomic token booking, family members, priority queue, manager queue controls, notifications, WebSocket updates, optional Firebase push, AI department guide, password recovery, and admin APIs.
- Kept the friend's admin route/API behavior, but mapped its legacy `type` and `rejection_note` SQL fields to the consolidated schema's `hospital_type` and `rejection_reason` columns. The legacy JSON response keys remain `type` and `rejection_note`.
- Added a database compatibility migration that copies legacy hospital values (`type`, `rejection_note`) into the consolidated columns when those old columns exist.
- Migrates legacy token status `in_progress` to the consolidated `serving` status.
- Updated the admin active-queue count to use `serving`, matching the queue service and token schema.
- Made approved-hospital browsing public, matching the original patient-browsing behavior. Private manager/admin data remains protected by the controller checks.
- Kept the current consolidated API routes documented in `README.md`. Patient booking is handled by `/api/tokens`; queue operations are under `/api/queue`.

## Before running

1. Copy `.env.example` to `.env` and set real values for `DATABASE_URL`, `JWT_SECRET`, `EMAIL_USER`, and `EMAIL_PASS`. Optional Firebase/Gemini settings are documented in the template.
2. Back up any existing database before applying schema changes.
3. Run `npm install`, then `npm run setup-db`, then `npm test`.
4. For a local development admin, use `npm run create-admin -- admin@example.com "StrongPassword" "Admin Name"`.
5. Start with `npm run dev`.

## Validation performed for this package

- All JavaScript files passed `node --check`.
- All six existing unit tests passed with `npm test`.
- Local `require()` paths were checked; no missing local modules were found.
- `package.json` and `package-lock.json` dependency declarations match.
- No `.env`, `.git`, `node_modules`, or Firebase service-account file is included.

## Important limitation

A live PostgreSQL integration test and a full dependency installation could not be run in this environment because no project database credentials were provided and the npm package cache was incomplete/offline. Run the setup and tests in your own environment before deploying. Do not point the setup script at production until you have a verified backup.
