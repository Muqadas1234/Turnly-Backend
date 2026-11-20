const http = require('http');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// initialize database connection
require('./config/db');

// route imports
const authRoutes = require('./routes/auth.routes');
const hospitalRoutes = require('./routes/hospital.routes');
const departmentRoutes = require('./routes/department.routes');
const doctorRoutes = require('./routes/doctor.routes');
const tokenRoutes = require('./routes/token.routes');
const queueRoutes = require('./routes/queue.routes');
const familyRoutes = require('./routes/family.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes = require('./routes/admin.routes');
const aiRoutes = require('./routes/ai.routes');
const patientRoutes = require('./routes/patient.routes');

const realtime = require('./services/realtime');
const { expireStaleTokens } = require('./services/token.service');
const { AppError } = require('./utils/http');

const app = express();
app.disable('x-powered-by');

// middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// api routes
app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/patient', patientRoutes);

// health check endpoints
app.get('/', (req, res) => {
    res.json({ status: 'API is running' });
});
app.get('/health', (req, res) => {
    res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});

// handle 404 routes
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// global error handler
app.use((err, req, res, next) => {
    if (err instanceof AppError) {
        return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Request body is not valid JSON' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// live queue updates over WebSocket: ws://HOST:PORT/ws?token=<JWT>
realtime.attach(server);

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// housekeeping: close tokens from past days that were never processed (every 10 minutes)
const cleanup = setInterval(() => {
    expireStaleTokens().catch((e) => console.error('Token cleanup error:', e.message));
}, 10 * 60 * 1000);
cleanup.unref();

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
