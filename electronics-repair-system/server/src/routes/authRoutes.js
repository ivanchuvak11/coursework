const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = require('express').Router();
const pool = require('../database/pool');
const { isBlank, sendValidationError } = require('../utils/validation');

async function verifyUserPassword(user, password) {
    const storedPassword = user.password_hash || '';

    if (storedPassword.startsWith('$2')) {
        return bcrypt.compare(password, storedPassword);
    }

    const isLegacyPasswordValid = storedPassword === password;
    if (isLegacyPasswordValid) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, user.id]);
    }

    return isLegacyPasswordValid;
}

module.exports = function createAuthRoutes(authMiddleware, jwtSecret) {
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;
        if (isBlank(username) || isBlank(password)) {
            return sendValidationError(res, ['Вкажіть логін і пароль']);
        }

        try {
            const result = await pool.query(
                'SELECT id, username, role, password_hash FROM users WHERE username = $1',
                [String(username).trim()]
            );
            const user = result.rows[0];

            if (!user || !(await verifyUserPassword(user, password))) {
                return res.status(401).json({ error: 'Невірний логін або пароль' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                jwtSecret,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                user: { id: user.id, username: user.username, role: user.role },
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    });

    router.get('/me', authMiddleware, (req, res) => {
        res.json(req.user);
    });

    router.post('/logout', authMiddleware, (req, res) => {
        res.json({ success: true });
    });

    return router;
};
