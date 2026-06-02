const express = require('express');
const cors = require('cors');
const { createAuthMiddleware } = require('./middleware/auth');
const createAuthRoutes = require('./routes/authRoutes');
const createOrderRoutes = require('./routes/orderRoutes');
const createPartRoutes = require('./routes/partRoutes');
const createClientRoutes = require('./routes/clientRoutes');
const createSystemRoutes = require('./routes/systemRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'repairmaster-secret-key-2024';
const authMiddleware = createAuthMiddleware(JWT_SECRET);

function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use('/api/auth', createAuthRoutes(authMiddleware, JWT_SECRET));
    app.use('/api/orders', createOrderRoutes(authMiddleware));
    app.use('/api/parts', createPartRoutes(authMiddleware));
    app.use('/api/clients', createClientRoutes(authMiddleware));
    app.use('/api', createSystemRoutes(authMiddleware));

    return app;
}

module.exports = {
    createApp,
};
