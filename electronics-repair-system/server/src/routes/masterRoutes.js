const router = require('express').Router();
const pool = require('../database/pool');
const { requireAnyRole } = require('../utils/accessControl');

module.exports = function createMasterRoutes(authMiddleware) {
    router.get('/', authMiddleware, requireAnyRole('адмін', 'менеджер'), async (_req, res) => {
        try {
            const result = await pool.query(`
                SELECT id, full_name, username
                FROM masters
                WHERE is_active = TRUE
                ORDER BY full_name
            `);

            res.json(result.rows);
        } catch (err) {
            console.error('Помилка /api/masters:', err.message);
            res.status(500).json({ error: 'Помилка завантаження майстрів' });
        }
    });

    return router;
};
