const express = require('express');
const cors = require('cors');
require('dotenv').config();

// initialize database connection
require('./config/db');

// route imports
const authRoutes = require('./routes/auth.routes');

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// api routes
app.use('/api/auth', authRoutes);

// health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'API is running' });
});

// handle 404 routes
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// global error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
